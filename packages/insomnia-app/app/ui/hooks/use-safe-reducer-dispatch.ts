import { useCallback } from 'react';
import { useMountedState } from 'react-use';

export const useSafeReducerDispatch = <A>(dispatch: (action: A) => void) => {
  const isMounted = useMountedState();

  const safeDispatch = useCallback<typeof dispatch>((...args) => {
    if (isMounted()) {
      dispatch(...args);
    }
  }, [dispatch, isMounted]);

  return safeDispatch;
};
