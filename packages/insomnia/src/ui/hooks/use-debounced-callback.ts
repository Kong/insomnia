import { useCallback, useEffect, useRef } from 'react';

const DEFAULT_DEBOUNCE_MS = 400;

/**
 * Call `callback` once calls stop for `delay` ms, with the last arguments.
 * A pending call runs when the component unmounts, so a debounced save never
 * drops the final edit when the user navigates away.
 */
export const useDebouncedCallback = <Args extends unknown[]>(
  callback: (...args: Args) => void,
  delay = DEFAULT_DEBOUNCE_MS,
) => {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;
  const timerRef = useRef<number | undefined>(undefined);
  const pendingRef = useRef<Args | null>(null);

  const runPending = useCallback(() => {
    const pending = pendingRef.current;
    pendingRef.current = null;
    if (pending) {
      callbackRef.current(...pending);
    }
  }, []);

  const debounced = useCallback(
    (...args: Args) => {
      pendingRef.current = args;
      window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        timerRef.current = undefined;
        runPending();
      }, delay);
    },
    [delay, runPending],
  );

  useEffect(
    () => () => {
      window.clearTimeout(timerRef.current);
      timerRef.current = undefined;
      runPending();
    },
    [runPending],
  );

  return debounced;
};
