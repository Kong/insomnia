// This file implements just enough of the electron module to get sending requests to work
module.exports = {
  app: {
    getPath: (/** @type {string} */ name) => {
      if (name === 'temp') {
        return require('os').tmpdir();
      }
      if (name === 'userData') {
        return process.env.INSOMNIA_DATA_PATH || require('path').join(require('os').tmpdir(), 'insomnia-send-request');
      }
      throw new Error(`Unknown app path: ${name}`);
    }
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
