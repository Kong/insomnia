import { useCallback, useEffect, useRef } from 'react';

// Taken from https://github.com/streamich/react-use/blob/master/src/useMountedState.ts
// Pulling react-use into the project seems to be causing issues...
export const useMountedState = () => {
  const mountedRef = useRef<boolean>(false);
  const get = useCallback(() => mountedRef.current, []);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  return get;
};
