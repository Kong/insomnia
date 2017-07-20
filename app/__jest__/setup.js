import 'whatwg-fetch';

// For slow CI servers
jasmine.DEFAULT_TIMEOUT_INTERVAL = 10000;

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
