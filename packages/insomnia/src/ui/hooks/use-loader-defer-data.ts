import { useEffect, useState } from 'react';

export const useLoaderDeferData = <T>(deferedDataPromise?: Promise<T>): [T | undefined, boolean, any] => {
  const [data, setData] = useState<T>();
  const [error, setError] = useState();
  const [isPending, setIsPending] = useState(true);
  useEffect(() => {
    if (deferedDataPromise === undefined) {
      return;
    }
    (async () => {
      try {
        const data = await deferedDataPromise;
        setIsPending(false);
        setData(data);
      } catch (err) {
        setError(err);
        console.error('Failed to load defered data', err);
      }
    })();
  }, [deferedDataPromise]);

  return [data, isPending, error];
};
