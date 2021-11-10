/// <reference types="webpack-env" />
import { applyMiddleware, compose, createStore, Store } from 'redux';
import thunkMiddleware from 'redux-thunk';

import { reducer } from './modules';

// TODO there's a circular dependency between this file and /redux/create
export default function() {
  const composeEnhancers =
    typeof window === 'object' && window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__
      ? window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__({
        // Specify extension’s options like name, actionsBlacklist, actionsCreators, serialize...
      })
      : compose;
  const middleware = [thunkMiddleware];
  const enhancer = composeEnhancers(
    applyMiddleware(...middleware), // other store enhancers if any
  );
  const store = createStore(reducer, enhancer);

  if (__DEV__ && module.hot) {
    module.hot.accept('./modules/index', () => {
      store.replaceReducer(reducer);
    });
  }

  return store as Store;
}
