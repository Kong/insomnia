import {createStore, applyMiddleware} from 'redux'
import thunkMiddleware from 'redux-thunk'
import createLogger from 'redux-logger'
import rootReducer from '../reducers/global'
import localStorageMiddleware from '../middleware/localstorage'

const loggerMiddleware = createLogger({
  collapsed: true
});

export default function configureStore (initialState) {
  const store = createStore(
    rootReducer,
    initialState,
    applyMiddleware(
      thunkMiddleware,
      localStorageMiddleware,
      loggerMiddleware
    )
  );

  if (module.hot) {
    // Enable Webpack hot module replacement for reducers
    module.hot.accept('../reducers/global', () => {
      const nextReducer = require('../reducers/global').default;
      store.replaceReducer(nextReducer);
    })
  }

  return store
}
