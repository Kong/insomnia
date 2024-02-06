const { ipcRenderer, contextBridge } = require('electron');
const bridge = {
  on: (channel, listener) => {
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },
  crypto: {
    createHash: algorithm => {
      return {
        update: (data, inputEncoding) => {
          return {
            digest: outputEncoding => {
              return require('crypto').createHash(algorithm).update(data, inputEncoding).digest(outputEncoding);
            },
          };
        },
      };
    },
  },
  runPreRequestScript: (script, context) => {
    return context.request;
  },
};
if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('bridge', bridge);
} else {
  window.bridge = bridge;
}
