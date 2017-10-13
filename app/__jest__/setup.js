import 'whatwg-fetch';

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
global.requestAnimationFrame = cb => process.nextTick(cb);
global.require = require;
