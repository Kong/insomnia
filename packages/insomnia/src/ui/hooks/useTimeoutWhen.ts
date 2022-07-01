
import { useEffect, useRef } from 'react';
// https://github.com/imbhargav5/rooks/blob/main/src/hooks/useTimeoutWhen.ts
/**
 * A setTimeout hook that calls a callback after a timeout duration
 * when a condition is true
 *
 * @param cb The callback to be invoked after timeout
 * @param timeoutDelayMs Amount of time in ms after which to invoke
 * @param when The condition which when true, sets the timeout
 */
function useTimeoutWhen(
  callback_: () => void,
  timeoutDelayMs = 0,
  when = true
): void {
  const savedRefCallback = useRef<() => any>();

  useEffect(() => {
    savedRefCallback.current = callback_;
  });

  function callback() {
    savedRefCallback.current && savedRefCallback.current();
  }

  useEffect(() => {
    if (when) {
      if (typeof window !== 'undefined') {
        const timeout = window.setTimeout(callback, timeoutDelayMs);

        return () => {
          window.clearTimeout(timeout);
        };
      } else {
        console.warn('useTimeoutWhen: window is undefined.');
      }
    }
    return;
  }, [timeoutDelayMs, when]);
}

export { useTimeoutWhen };
