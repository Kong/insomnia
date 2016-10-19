import {DEBOUNCE_MILLIS} from '../../backend/constants';

export function debounce (callback, millis = DEBOUNCE_MILLIS) {
  let timeout = null;
  return function () {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      callback.apply(null, arguments)
    }, millis);
  }
}
