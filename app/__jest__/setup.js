import 'whatwg-fetch';
import beforeEach from './before-each';

const localStorageMock = (function () {
  let store = {};

  return {
    getItem (key) {
      return store[key];
    },
    setItem (key, value) {
      store[key] = value.toString();
    },
    clear () {
      store = {};
    }
  };
})();

global.localStorage = localStorageMock;
global.require = require;
global.insomniaBeforeEach = beforeEach;
