import { contextBridge, ipcRenderer } from 'electron';

const main: Window['main'] = {
  restart: () => ipcRenderer.send('restart'),
  authorizeUserInWindow: options => ipcRenderer.invoke('authorizeUserInWindow', options),
  setMenuBarVisibility: options => ipcRenderer.send('setMenuBarVisibility', options),
  installPlugin: options => ipcRenderer.invoke('installPlugin', options),
  curlRequest: options => ipcRenderer.invoke('curlRequest', options),
  cancelCurlRequest: options => ipcRenderer.send('cancelCurlRequest', options),
  writeFile: options => ipcRenderer.invoke('writeFile', options),
  createWebsocketRequest: options => ipcRenderer.invoke('createWebsocketRequest', options),
  getWebSocketConnectionStatus: options => ipcRenderer.invoke('getWebSocketConnectionStatus', options),
  getWebSocketEventLog: options => ipcRenderer.invoke('getWebSocketEventLog', options),
  openWebsocket: options => ipcRenderer.send('openWebsocket', options),
  messageWebsocket: options => ipcRenderer.send('messageWebsocket', options),
  closeWebsocket: options => ipcRenderer.send('closeWebsocket', options),
  on: (channel, listener) => {
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },
};
const dialog: Window['dialog'] = {
  showOpenDialog: options => ipcRenderer.invoke('showOpenDialog', options),
  showSaveDialog: options => ipcRenderer.invoke('showSaveDialog', options),
};
const app: Window['app'] = {
  getPath: options => ipcRenderer.sendSync('getPath', options),
  getAppPath: () => ipcRenderer.sendSync('getAppPath'),
};
const shell: Window['shell'] = {
  showItemInFolder: options => ipcRenderer.send('showItemInFolder', options),
};

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('main', main);
  contextBridge.exposeInMainWorld('dialog', dialog);
  contextBridge.exposeInMainWorld('app', app);
  contextBridge.exposeInMainWorld('shell', shell);
} else {
  window.main = main;
  window.dialog = dialog;
  window.app = app;
  window.shell = shell;
}
