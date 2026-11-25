/**
 * @vitest-environment jsdom
 */
import type { Request } from 'insomnia-data';
import React, { act, createRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GenerateCodeModal, type GenerateCodeModalHandle } from '../generate-code-modal';

// vitest has no react-router/react plugin, so app components are transformed with the classic
// JSX runtime and look up a global `React`.
(globalThis as typeof globalThis & { React?: typeof React }).React = React;
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

// The factory is hoisted above the static imports, so React must be loaded inside it.
vi.mock('~/ui/components/.client/codemirror/code-editor', async () => {
  const { forwardRef, useImperativeHandle, useState } = await import('react');
  const MockCodeEditor = forwardRef<
    { setValue: (value: string) => void },
    { defaultValue?: string; placeholder?: string }
  >(function MockCodeEditor({ defaultValue = '', placeholder }, ref) {
    const [value, setValue] = useState(defaultValue);
    useImperativeHandle(ref, () => ({ setValue }), []);
    return <div>{value || placeholder}</div>;
  });
  return { CodeEditor: MockCodeEditor };
});

const request = { _id: 'req_1', name: 'Request 1' } as unknown as Request;

let generateSnippet: () => Promise<string>;

describe('GenerateCodeModal', () => {
  let container: HTMLElement;
  let root: Root;
  let ref: { current: GenerateCodeModalHandle | null };

  const renderModal = () => {
    ref = createRef<GenerateCodeModalHandle>();
    act(() => {
      root.render(<GenerateCodeModal ref={ref} environmentId="env_1" />);
    });
  };

  const show = async () => {
    await act(async () => {
      ref.current?.show({ request });
    });
  };

  const errorText = () => document.querySelector('[data-testid="generate-code-error"]')?.textContent ?? null;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    vi.stubGlobal('main', {
      getCodeSnippetTargets: async () => [{ key: 'shell', title: 'Shell', clients: [{ key: 'curl', title: 'cURL' }] }],
      exportHarWithRequest: async () => ({ url: 'https://api.example.com', method: 'GET' }),
      generateCodeSnippet: () => generateSnippet(),
      trackAnalyticsEvent: () => {},
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it('shows why the code snippet could not be generated', async () => {
    generateSnippet = async () => {
      throw new Error('Could not generate code: URL is not a valid URL — check it is not empty.');
    };
    renderModal();

    await show();

    await vi.waitFor(() => {
      expect(errorText()).toContain('Could not generate code: URL is not a valid URL');
    });
  });

  it('clears the error and renders the snippet when a later attempt succeeds', async () => {
    generateSnippet = async () => {
      throw new Error('Validation Failed');
    };
    renderModal();
    await show();
    await vi.waitFor(() => {
      expect(errorText()).not.toBeNull();
    });

    generateSnippet = async () => 'curl https://api.example.com';
    await show();

    await vi.waitFor(() => {
      expect(errorText()).toBeNull();
      expect(document.body.textContent).toContain('curl https://api.example.com');
    });
  });

  it('ignores a superseded generation that finishes after a newer one', async () => {
    // Promise.withResolvers is not in the ES2023 lib this package targets.
    let rejectFirst!: (error: Error) => void;
    const firstAttempt = new Promise<string>((_resolve, reject) => {
      rejectFirst = reject;
    });
    const attempts = [firstAttempt, Promise.resolve('curl from the newer attempt')];
    generateSnippet = () => attempts.shift() ?? Promise.resolve('');
    renderModal();

    await show();
    await show();
    await vi.waitFor(() => {
      expect(document.body.textContent).toContain('curl from the newer attempt');
    });

    await act(async () => {
      rejectFirst(new Error('stale validation failure'));
    });

    expect(errorText()).toBeNull();
    expect(document.body.textContent).toContain('curl from the newer attempt');
  });
});
