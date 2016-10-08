module.exports = {
  remote: {
    app: {
      getPath (name) {
        return `/tmp/insomnia-tests/${name}`
      }
    }
  }
};
