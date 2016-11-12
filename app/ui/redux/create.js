import {createStore, applyMiddleware} from 'redux';
import createLogger from 'redux-logger';
import thunkMiddleware from 'redux-thunk';
import rootReducer from './reducer';

export default function configureStore () {
  const middleware = [thunkMiddleware];

  if (false && __DEV__) {
    middleware.push(createLogger({collapsed: true}));
  }

  const store = createStore(rootReducer, applyMiddleware(...middleware));

  if (module.hot) {
    module.hot.accept('./reducer', () => {
      const nextReducer = require('./reducer');
      store.replaceReducer(nextReducer);
    })
  }

  return store;
}
