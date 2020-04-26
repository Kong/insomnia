// @flow

declare module 'electron-updater' {
  declare module.exports: {
    autoUpdater: {
      requestHeaders: Object,
      checkForUpdatesAndNotify: () => void,
    },
  };
}
