import {createStore, applyMiddleware} from 'redux';
import thunkMiddleware from 'redux-thunk'
import createLogger from 'redux-logger'
import localStorageMiddleware, {getState} from './middleware/localstorage';

import rootReducer from './reducer';
import {LOCALSTORAGE_KEY} from '../lib/constants';


export default function configureStore () {
  const middleware = [
    thunkMiddleware,
    localStorageMiddleware(LOCALSTORAGE_KEY)
  ];

  if (__DEV__) {
    // middleware.push(createLogger({collapsed: true}));
  }

  // Create the store and apply middleware
  const store = createStore(
    rootReducer,
    getState(LOCALSTORAGE_KEY),
    applyMiddleware(...middleware)
  );

  if (module.hot) {
    module.hot.accept('./reducer', () => {
      const nextReducer = require('./reducer.js').default;
      store.replaceReducer(nextReducer);
    })
  }

  return store;
}
