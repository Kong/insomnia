import 'whatwg-fetch';

const localStorageMock = (function() {
  let store = {};

  return {
    getItem(key) {
      return store[key];
    },
    setItem(key, value) {
      store[key] = value.toString();
    },
    clear() {
      store = {};
    }
  };
})();

global.__DEV__ = false;
global.localStorage = localStorageMock;
global.requestAnimationFrame = cb => process.nextTick(cb);
global.require = require;

// Don't console log real logs that start with a tag (eg. [db] ...). It's annoying
const log = console.log;
global.console.log = (...args) => {
  if (!(typeof args[0] === 'string' && args[0][0] === '[')) {
    log(...args);
  }
};
