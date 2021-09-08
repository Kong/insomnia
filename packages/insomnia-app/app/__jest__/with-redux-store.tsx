import React from 'react';
import { Provider } from 'react-redux';
import { MockStoreEnhanced } from 'redux-mock-store';

import { RootState } from '../ui/redux/modules';

export const withReduxStore = (store: MockStoreEnhanced<RootState, {}>) =>
  class ReduxWrapper extends React.Component {
    render() {
      const { children } = this.props;
      return <Provider store={store}>{children}</Provider>;
    }
  };
