// @flow
import * as React from 'react';

export const useToggleState = (initialState: boolean = false): [boolean, () => void] => {
  const [state, set] = React.useState(initialState);
  const toggle = React.useCallback(() => set(oldState => !oldState), []);
  return [state, toggle];
};
