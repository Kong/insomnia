export default {
  remote: {
    app: {
      getPath (name) {
        return `/tmp/insomnia-tests/${name}`
      }
    }
  },
  ipcRenderer: {
    on () {

    }
  }
}
