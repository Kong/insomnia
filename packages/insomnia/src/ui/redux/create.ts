import { applyMiddleware, compose, createStore, Store } from 'redux';
import thunkMiddleware from 'redux-thunk';

import { reducer } from './modules';

// TODO there's a circular dependency between this file and /redux/create
export default function() {
  const composeEnhancers =
    '__REDUX_DEVTOOLS_EXTENSION_COMPOSE__' in window
      ? window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__({
        // Specify extension’s options like name, actionsBlacklist, actionsCreators, serialize...
      })
      : compose;
  const middleware = [thunkMiddleware];
  const enhancer = composeEnhancers(
    applyMiddleware(...middleware), // other store enhancers if any
  );
  const store = createStore(reducer, enhancer);

  return store as Store;
}
