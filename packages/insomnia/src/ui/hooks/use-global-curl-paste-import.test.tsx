/**
 * @vitest-environment jsdom
 */
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { isEditablePasteTarget, useGlobalCurlPasteImport } from './use-global-curl-paste-import';

describe('isEditablePasteTarget', () => {
  it('matches native form fields', () => {
    expect(isEditablePasteTarget({ tagName: 'INPUT' })).toBe(true);
    expect(isEditablePasteTarget({ tagName: 'TEXTAREA' })).toBe(true);
  });

  it('matches contenteditable surfaces (e.g. CodeMirror editors)', () => {
    expect(isEditablePasteTarget({ tagName: 'DIV', isContentEditable: true })).toBe(true);
  });

  it('does not match non-editable elements or non-element targets', () => {
    expect(isEditablePasteTarget({ tagName: 'DIV', isContentEditable: false })).toBe(false);
    expect(isEditablePasteTarget({ tagName: 'BODY' })).toBe(false);
    expect(isEditablePasteTarget({})).toBe(false);
    expect(isEditablePasteTarget(null)).toBe(false);
    expect(isEditablePasteTarget('body')).toBe(false);
  });
});

// jsdom has no ClipboardEvent constructor; a plain Event with a stubbed
// clipboardData exercises the same handler path.
const paste = (text: string, target: Element) => {
  const event = new Event('paste', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'clipboardData', { value: { getData: () => text } });
  act(() => {
    target.dispatchEvent(event);
  });
  return event.defaultPrevented;
};

// Harness follows insomnia-tab-context.test.tsx: manual createRoot + act,
// since @testing-library/react cannot resolve its dependencies here.
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

interface HarnessProps {
  enabled: boolean;
  onCurlPaste: (curl: string) => void;
}

const TestComponent: React.FC<HarnessProps> = ({ enabled, onCurlPaste }) => {
  useGlobalCurlPasteImport({ enabled, onCurlPaste });
  return null;
};

describe('useGlobalCurlPasteImport', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  const renderHarness = (props: HarnessProps) => {
    act(() => {
      root.render(<TestComponent {...props} />);
    });
  };

  it('intercepts a cURL pasted outside editable surfaces', () => {
    const onCurlPaste = vi.fn();
    renderHarness({ enabled: true, onCurlPaste });

    expect(paste('curl https://example.com', document.body)).toBe(true);
    expect(onCurlPaste).toHaveBeenCalledWith('curl https://example.com');
  });

  it('ignores pastes into editable surfaces and non-curl text', () => {
    const onCurlPaste = vi.fn();
    renderHarness({ enabled: true, onCurlPaste });

    const input = document.createElement('input');
    document.body.append(input);
    expect(paste('curl https://example.com', input)).toBe(false);
    expect(paste('https://example.com', document.body)).toBe(false);
    expect(onCurlPaste).not.toHaveBeenCalled();
  });

  it('stops listening while disabled and picks up callback updates', () => {
    const first = vi.fn();
    const second = vi.fn();
    renderHarness({ enabled: true, onCurlPaste: first });

    renderHarness({ enabled: false, onCurlPaste: first });
    expect(paste('curl https://example.com', document.body)).toBe(false);
    expect(first).not.toHaveBeenCalled();

    renderHarness({ enabled: true, onCurlPaste: second });
    expect(paste('curl https://example.com', document.body)).toBe(true);
    expect(second).toHaveBeenCalledWith('curl https://example.com');
    expect(first).not.toHaveBeenCalled();
  });
});
