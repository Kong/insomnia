import React, { FC } from 'react';
import { Provider } from 'react-redux';
import { MockStoreEnhanced } from 'redux-mock-store';

import { RootState } from '../ui/redux/modules';

// eslint-disable-next-line react/display-name -- There's not a good way to do with a FunctionComponent while also maintaining the display name.
export const withReduxStore = (store: MockStoreEnhanced<RootState, {}>): FC => ({ children }) => (
  <Provider store={store}>{children}</Provider>
);
