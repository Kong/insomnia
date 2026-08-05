import { useCallback, useState } from 'react';

export const useLoadingRecord = () => {
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  const startLoading = useCallback((id: string) => {
    setLoading(prevState => ({ ...prevState, [id]: true }));
  }, []);

  const stopLoading = useCallback((id: string) => {
    setLoading(prevState => ({ ...prevState, [id]: false }));
  }, []);

  const isLoading = useCallback((id: string) => Boolean(loading[id]), [loading]);

  return { startLoading, stopLoading, isLoading };
};
