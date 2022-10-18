import React, { FC, PropsWithChildren } from 'react';
import { Provider } from 'react-redux';
import { MockStoreEnhanced } from 'redux-mock-store';

import { RootState } from '../ui/redux/modules';

// eslint-disable-next-line react/display-name -- There's not a good way to do with a FunctionComponent while also maintaining the display name.
export const withReduxStore = (store: MockStoreEnhanced<RootState, {}>, Node?: React.ElementType): FC<PropsWithChildren<{}>> => ({ children }) => {
  return (
    <Provider store={store}>
      {Node ? <Node>{children}</Node> : children}
    </Provider>
  );
};
