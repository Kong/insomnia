globalThis.__DEV__ = false;

globalThis.requestAnimationFrame = (callback: FrameRequestCallback) => {
  process.nextTick(callback);
  // note: the spec indicates that the return of this function (the request id) is a non-zero number.  hopefully returning 0 here will indicate that this is a mock if the return is ever to be used accidentally.
  return 0;
};

globalThis.require = require;

// Don't console log real logs that start with a tag (eg. [db] ...). It's annoying
const log = console.log;

globalThis.console.log = (...args) => {
  if (!(typeof args[0] === 'string' && args[0][0] === '[')) {
    log(...args);
  }
};

global.main = {
  trackSegmentEvent: () => { },
  trackPageView: () => { },
};
