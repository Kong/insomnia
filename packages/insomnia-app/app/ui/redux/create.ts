import { createStore, applyMiddleware, compose } from 'redux';
import thunkMiddleware from 'redux-thunk';
import { reducer } from './modules';

export default function () {
  const composeEnhancers =
    // @ts-expect-error
    typeof window === 'object' && window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__
      // @ts-expect-error
      ? window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__({
        // Specify extension’s options like name, actionsBlacklist, actionsCreators, serialize...
      })
      : compose;
  const middleware = [thunkMiddleware];
  const enhancer = composeEnhancers(
    applyMiddleware(...middleware), // other store enhancers if any
  );
  const store = createStore(reducer, enhancer);

  // @ts-expect-error
  if (__DEV__ && module.hot) {
    // @ts-expect-error
    module.hot.accept('./modules/index', () => {
      store.replaceReducer(reducer);
    });
  }

  return store;
}
