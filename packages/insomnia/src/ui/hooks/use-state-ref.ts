// Copied from https://github.com/Aminadav/react-useStateRef
import { type Dispatch, type SetStateAction, useCallback, useRef, useState } from 'react';

const isFunction = <S>(setStateAction: SetStateAction<S>): setStateAction is (prevState: S) => S =>
  typeof setStateAction === 'function';

interface ReadOnlyRefObject<T> {
  readonly current: T;
}

interface UseStateRef {
  <S>(initialState: S | (() => S)): [S, Dispatch<SetStateAction<S>>, ReadOnlyRefObject<S>];
  <T = undefined>(): [T | undefined, Dispatch<SetStateAction<T | undefined>>, ReadOnlyRefObject<T | undefined>];
}

const useStateRef: UseStateRef = <S>(initialState?: S | (() => S)) => {
  const [state, setState] = useState(initialState);
  const ref = useRef(state);

  const dispatch: typeof setState = useCallback((setStateAction: any) => {
    ref.current = isFunction(setStateAction) ? setStateAction(ref.current) : setStateAction;

    setState(ref.current);
  }, []);

  return [state, dispatch, ref];
};

export default useStateRef;
