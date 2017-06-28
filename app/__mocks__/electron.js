const RANDOM_STRING = Math.random().toString().replace('.', '');

module.exports = {
  remote: {
    app: {
      getPath (name) {
        return `/tmp/insomnia-tests-${RANDOM_STRING}/${name}`;
      }
    }
  },
  ipcRenderer: {
    on () {

    }
  }
};
