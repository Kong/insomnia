import mkdirp from 'mkdirp';
const RANDOM_STRING = Math.random().toString().replace('.', '');

module.exports = {
  remote: {
    app: {
      getPath (name) {
        const dir = `/tmp/insomnia-tests-${RANDOM_STRING}/${name}`;
        mkdirp.sync(dir);
        return dir;
      }
    }
  },
  ipcRenderer: {
    on () {

    }
  }
};
