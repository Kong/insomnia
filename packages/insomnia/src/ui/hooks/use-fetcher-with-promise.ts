import { useCallback, useEffect, useRef } from 'react';
import { type FetcherWithComponents, useFetcher } from 'react-router-dom';

type ResolveFn<T> = (data: T) => void;
type FetcherWithPromise<TData> = FetcherWithComponents<TData> & {
  submit: (...args: Parameters<FetcherWithComponents<TData>['submit']>) => Promise<TData>;
  load: (href: string) => Promise<TData>;
};

export function useFetcherWithPromise<TData>(
  opts?: Parameters<typeof useFetcher>[0]
): FetcherWithPromise<TData> {
  const fetcher = useFetcher<TData>(opts);
  const resolverRef = useRef<ResolveFn<TData> | null>(null);

  const submit = useCallback(
    (...args: Parameters<typeof fetcher.submit>) => {
      console.log('return submit');
      return new Promise<TData>(resolve => {
        resolverRef.current = resolve;
        fetcher.submit(...args);
      });
    },
    [fetcher]
  );

  const load = useCallback((href: string) => {
    return new Promise<TData>(resolve => {
      resolverRef.current = resolve;
      fetcher.load(href);
    });
  }, [fetcher]);

  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data !== undefined) {
      resolverRef.current?.(fetcher.data);
      resolverRef.current = null;
    }
  }, [fetcher.state, fetcher.data]);

  return { ...fetcher, submit, load };
}
