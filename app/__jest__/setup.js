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

global.console.debug = global.console.log;
global.localStorage = localStorageMock;
global.requestAnimationFrame = cb => process.nextTick(cb);
global.require = require;
