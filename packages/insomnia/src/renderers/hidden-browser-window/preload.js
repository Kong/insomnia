const { ipcRenderer, contextBridge } = require('electron');

const bridge = {
  on: (channel, listener) => {
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },
};
if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('bridge', bridge);
} else {
  window.bridge = bridge;
}
