import { useEffect, useRef, useState } from 'react';

export const useLoaderDeferData = <T>(deferedDataPromise?: Promise<T>, keepStaleDataKey?: string): [T | undefined, boolean, any] => {
  const [data, setData] = useState<T>();
  const [error, setError] = useState();
  const [isPending, setIsPending] = useState(true);

  const keepStaleDataKeyRef = useRef(keepStaleDataKey);

  useEffect(() => {
    if (deferedDataPromise === undefined) {
      return;
    }
    (async () => {
      try {
        // use keepStaleDataKey to let us know if we should keep the stale data or not
        // sometimes we want to keep the stale data if we are fetching the same data again
        // sometimes we want to clear the stale data if we are fetching different data
        if (keepStaleDataKeyRef.current !== keepStaleDataKey) {
          setData(undefined);
        }
        keepStaleDataKeyRef.current = keepStaleDataKey;
        const data = await deferedDataPromise;
        setIsPending(false);
        setData(data);
      } catch (err) {
        setError(err);
        console.log('Failed to load defered data', err);
      }
    })();
  }, [deferedDataPromise, keepStaleDataKey]);

  return [data, isPending, error];
};
