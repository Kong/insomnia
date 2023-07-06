import type { Config } from 'jest';
const localStorageMock: Storage = (function () {
  let store: Record<string, string> = {};
  return {
    get length() {
      return Object.keys(store).length;
    },

    clear() {
      store = {};
    },

    getItem(key: string) {
      return store[key];
    },

    key() {
      return null;
    },

    removeItem(key: string) {
      delete store[key];
    },

    setItem(key: string, value: string) {
      store[key] = value.toString();
    },
  };
})();
const log = console.log;
const config: Config = {
  globals: {
    __DEV__: false,
    localStorage: localStorageMock,
    requestAnimationFrame: (callback: FrameRequestCallback) => {
      process.nextTick(callback);
      // note: the spec indicates that the return of this function (the request id) is a non-zero number.  hopefully returning 0 here will indicate that this is a mock if the return is ever to be used accidentally.
      return 0;
    },
    global: { require },
    require,
    'console.log ': (...args: any[]) => {
      if (!(typeof args[0] === 'string' && args[0][0] === '[')) {
        log(...args);
      }
    },
  },
};

export default config;
