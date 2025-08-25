import { useEffect, useRef, useState } from 'react';

export const useLoaderDeferData = <T>(
  deferedDataPromise?: Promise<T>,
  keepStaleDataKey?: string,
): [T | undefined, boolean, any] => {
  const [data, setData] = useState<T>();
  const [error, setError] = useState();
  const [isPending, setIsPending] = useState(true);

  const keepStaleDataKeyRef = useRef(keepStaleDataKey);

  useEffect(() => {
    if (deferedDataPromise === undefined) {
      return;
    }

    const abortController = new AbortController();

    (async () => {
      try {
        // use keepStaleDataKey to let us know if we should keep the stale data or not
        // sometimes we want to keep the stale data (rename a collection -> action submit -> run loader)
        // sometimes we want to clear the stale data if we are fetching different data (switch to another project -> navigate -> run loader)
        if (keepStaleDataKeyRef.current !== keepStaleDataKey) {
          setData(undefined);
        }
        keepStaleDataKeyRef.current = keepStaleDataKey;
        const data = await deferedDataPromise;
        if (!abortController.signal.aborted) {
          setIsPending(false);
          setData(data);
          setError(undefined);
        }
      } catch (err) {
        if (!abortController.signal.aborted) {
          setIsPending(false);
          setError(err);
          console.warn('Failed to load deferred data', err);
        }
      }
    })();

    return () => {
      abortController.abort();
    };
  }, [deferedDataPromise, keepStaleDataKey]);

  return [data, isPending, error];
};
