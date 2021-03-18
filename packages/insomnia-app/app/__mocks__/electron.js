import mkdirp from 'mkdirp';
import events from 'events';
import os from 'os';
import path from 'path';

const RANDOM_STRING = Math.random()
  .toString()
  .replace('.', '');

const remote = {
  app: {
    getPath(name) {
      const dir = path.join(os.tmpdir(), `insomnia-tests-${RANDOM_STRING}`, name);
      mkdirp.sync(dir);
      return dir;
    },
    getLocale() {
      return 'en-US';
    },
  },
  net: {
    request(url) {
      const req = new events.EventEmitter();
      req.end = function() {};
      return req;
    },
  },
  BrowserWindow: {
    getAllWindows() {
      return [];
    },
    getFocusedWindow() {
      return {
        getContentBounds() {
          return { width: 1900, height: 1060 };
        },
      };
    },
  },
  screen: {
    getPrimaryDisplay() {
      return { workAreaSize: { width: 1920, height: 1080 } };
    },
  },
};

module.exports = {
  ...remote,
  remote: remote,
  ipcMain: {
    on: jest.fn(),
    once() {},
  },
  ipcRenderer: {
    on: jest.fn(),
    removeAllListeners: jest.fn(),
    once() {},
    send: jest.fn(),
  },
};
