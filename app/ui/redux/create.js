import {createStore, applyMiddleware} from 'redux';
import thunkMiddleware from 'redux-thunk';
import {reducer} from './modules';

export default function () {
  const middleware = [thunkMiddleware];
  const store = createStore(reducer, applyMiddleware(...middleware));
  if (__DEV__ && module.hot) {
    module.hot.accept('./modules/index', () => {
      store.replaceReducer(reducer);
    });
  }

  return store;
}
