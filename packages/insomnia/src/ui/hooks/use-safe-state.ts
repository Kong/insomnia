import { useCallback, useState } from 'react';
import * as reactUse from 'react-use';

export const useSafeState = <S>(initialValue: S | (() => S)) => {
  const isMounted = reactUse.useMountedState();

  const [state, _setState] = useState(initialValue);

  const setState = useCallback<typeof _setState>(
    (...args) => {
      if (isMounted()) {
        _setState(...args);
      }
    },
    [isMounted],
  );

  // This needs to happen to force a tuple return type
  const returnValue: [typeof state, typeof setState] = [state, setState];

  return returnValue;
};
