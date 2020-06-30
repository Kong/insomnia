// This file implements just enough of the electron module to get sending requests to work

const os = require('os');
const path = require('path');

function getPath(name) {
  switch (name) {
    case 'temp':
      return os.tmpdir();
    case 'userData':
      // Will be used to store response bodies and things
      return path.join(os.tmpdir(), 'insomnia-send-request');
  }
  throw new Error('Invalid path:' + name);
}

module.exports = {
  app: {
    getPath,
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
