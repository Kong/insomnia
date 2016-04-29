import {createStore, applyMiddleware} from 'redux'
import thunkMiddleware from 'redux-thunk'
import createLogger from 'redux-logger'
import localStorageMiddleware, {getState} from './middleware/localstorage'

import rootReducer from './reducer'
import {LOCALSTORAGE_KEY} from '../lib/constants'

export default function configureStore () {
  // Create the store and apply middleware
  const store = createStore(
    rootReducer,
    getState(LOCALSTORAGE_KEY),
    applyMiddleware(
      thunkMiddleware,
      localStorageMiddleware(LOCALSTORAGE_KEY),
      createLogger({collapsed: true})
    )
  );

  if (module.hot) {
    module.hot.accept('./reducer', () => {
      const nextReducer = require('./reducer.js').default;
      store.replaceReducer(nextReducer);
    })
  }

  return store;
}
