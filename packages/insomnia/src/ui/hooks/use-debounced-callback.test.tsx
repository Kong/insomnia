/**
 * @vitest-environment jsdom
 */
import React, { type FC, useEffect } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useDebouncedCallback } from './use-debounced-callback';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// The debounced call is published from an effect, not during render.
let callDebounced: ((value: string) => void) | null = null;

describe('useDebouncedCallback', () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;

  const Harness: FC<{ callback: (value: string) => void }> = ({ callback }) => {
    const debounced = useDebouncedCallback(callback, 400);
    useEffect(() => {
      callDebounced = debounced;
    }, [debounced]);
    return null;
  };

  beforeEach(() => {
    vi.useFakeTimers();
    callDebounced = null;
    container = document.createElement('div');
    root = createRoot(container);
  });

  afterEach(() => {
    if (root) {
      act(() => root?.unmount());
    }
    root = null;
    container = null;
    vi.useRealTimers();
  });

  it('calls once with the last arguments after the delay', () => {
    const callback = vi.fn();
    act(() => root?.render(<Harness callback={callback} />));

    act(() => {
      callDebounced!('a');
      callDebounced!('ab');
    });
    expect(callback).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith('ab');
  });

  it('flushes the pending call on unmount', () => {
    const callback = vi.fn();
    act(() => root?.render(<Harness callback={callback} />));

    act(() => {
      callDebounced!('last');
    });
    act(() => root?.unmount());
    root = null;

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith('last');
  });
});
