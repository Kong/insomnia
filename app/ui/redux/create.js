import {createStore, applyMiddleware} from 'redux';
import thunkMiddleware from 'redux-thunk';
import {reducer} from './modules';

export default function configureStore () {
  const middleware = [thunkMiddleware];

  if (__DEV__) {
    // const createLogger = require('redux-logger');
    // middleware.push(createLogger({collapsed: true}));
  }

  const store = createStore(reducer, applyMiddleware(...middleware));
  if (__DEV__ && module.hot) {
    module.hot.accept('./modules/index', () => {
      store.replaceReducer(reducer);
    });
  }

  return store;
}
