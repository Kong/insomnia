declare module 'electron' {
  declare module.exports: {
    remote: {
      shell: Object,
      app: Object,
      BrowserWindow: Object,
      ipcMain: Object,
      net: Object,
      dialog: Object
    },
    shell: Object,
    app: Object,
    BrowserWindow: Object,
    ipcRenderer: Object,
    ipcMain: Object,
    net: Object,
    dialog: Object,
    clipboard: Object
  }
}
