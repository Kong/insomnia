import {createStore, applyMiddleware} from 'redux';
import createLogger from 'redux-logger';
import thunkMiddleware from 'redux-thunk'
import localStorageMiddleware, {getState} from './middleware/localstorage';
import rootReducer from './reducer';
import {LOCALSTORAGE_KEY} from '../../backend/constants';


export default function configureStore () {
  const middleware = [
    thunkMiddleware,
    localStorageMiddleware(LOCALSTORAGE_KEY)
  ];

  if (__DEV__) {
    // middleware.push(createLogger({collapsed: true}));
  }

  // Create the store and apply middleware
  const restoredState = getState(LOCALSTORAGE_KEY);

  // Remove unused keys from restored state (migrate it)
  const initialState = rootReducer(undefined, {type: 'insomnia-init'});
  for (const key of Object.keys(restoredState)) {
    if (!initialState.hasOwnProperty(key)) {
      // TODO: Make this recursive
      console.warn('Deleting unused key from restored state', key);
      delete restoredState[key];
    }
  }

  const store = createStore(
    rootReducer,
    restoredState,
    applyMiddleware(...middleware)
  );

  if (module.hot) {
    module.hot.accept('./reducer', () => {
      const nextReducer = require('./reducer');
      store.replaceReducer(nextReducer);
    })
  }

  return store;
}
