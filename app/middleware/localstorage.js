import {LOCALSTORAGE_DEBOUNCE_MILLIS} from "../constants/global";

let timeout = null;
export default (store) => next => action => {
  let result = next(action);
  
  clearTimeout(timeout);
  timeout = setTimeout(() => {
    localStorage['insomnia'] = JSON.stringify(store.getState(), null, 2);
  }, LOCALSTORAGE_DEBOUNCE_MILLIS);
  
  return result;
};
