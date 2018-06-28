// @flow

declare module 'electron' {
  declare module.exports: {
    remote: {
      shell: Object,
      app: Object,
      BrowserWindow: Object,
      ipcMain: Object,
      session: Object,
      net: Object,
      dialog: Object,
      screen: Object
    },
    shell: Object,
    app: Object,
    BrowserWindow: Object,
    ipcRenderer: Object,
    ipcMain: Object,
    session: Object,
    net: Object,
    dialog: Object,
    clipboard: Object,
    screen: Object,
    autoUpdater: Object
  };
}
