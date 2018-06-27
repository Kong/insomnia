import mkdirp from 'mkdirp';
import events from 'events';

const RANDOM_STRING = Math.random()
  .toString()
  .replace('.', '');

const remote = {
  app: {
    getPath(name) {
      const dir = `/tmp/insomnia-tests-${RANDOM_STRING}/${name}`;
      mkdirp.sync(dir);
      return dir;
    },
    getLocale() {
      return 'en-US';
    }
  },
  net: {
    request(url) {
      const req = new events.EventEmitter();
      req.end = function() {};
      return req;
    }
  },
  BrowserWindow: {
    getAllWindows() {
      return [];
    },
    getFocusedWindow() {
      return {
        getContentBounds() {
          return { width: 1900, height: 1060 };
        }
      };
    }
  },
  screen: {
    getPrimaryDisplay() {
      return { workAreaSize: { width: 1920, height: 1080 } };
    }
  }
};

module.exports = {
  ...remote,
  remote: remote,
  ipcMain: {
    on() {},
    once() {}
  },
  ipcRenderer: {
    on() {},
    once() {},
    send() {}
  }
};
