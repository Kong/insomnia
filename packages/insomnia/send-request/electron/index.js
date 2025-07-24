// This file implements just enough of the electron module to get sending requests to work
// This is also used by the Inso to mock the Electron API, defined in paths property of compilerOptions under tsconfig.json
module.exports = {
  app: {
    getPath: (/** @type {string} */ name) =>
      name === 'temp' ? require('os').tmpdir() : require('path').join(require('os').tmpdir(), 'insomnia-send-request'),
  },
  ipcMain: {
    on: () => {
      // Don't need this yet
    },
  },
  BrowserWindow: {
    getAllWindows: () => [],
  },
};
