import mkdirp from 'mkdirp';
const RANDOM_STRING = Math.random().toString().replace('.', '');

const remote = {
  app: {
    getPath (name) {
      const dir = `/tmp/insomnia-tests-${RANDOM_STRING}/${name}`;
      mkdirp.sync(dir);
      return dir;
    }
  },
  BrowserWindow: {
    getAllWindows () {
      return [];
    }
  }
};

module.exports = {
  ...remote,
  remote: remote,
  ipcMain: {
    on () {

    }
  },
  ipcRenderer: {
    on () {

    }
  }
};
