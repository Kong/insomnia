const os = require('os');

function getPath(name) {
  switch (name) {
    case 'temp':
      return os.tmpdir();
    case 'userData':
      return '/Users/greg.schier/Library/Application Support/insomnia-app';
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
