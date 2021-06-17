import { useCallback, useEffect, useRef, useState } from 'react';

export const useStateIfMounted = <S>(initialValue: S | (() => S)) => {
  const isMounted = useRef(false);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  });

  const [state, _setState] = useState(initialValue);

  const setState = useCallback<typeof _setState>(state => {
    if (isMounted.current) {
      _setState(state);
    }
  }, [isMounted]);

  const returnValue: [typeof state, typeof _setState] = [state, setState];

  return returnValue;
};
