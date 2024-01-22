import { contextBridge, ipcRenderer } from 'electron';

const main: Window['curl'] = {
  curlRequest: options => ipcRenderer.invoke('curlRequest', options),
  cancelCurlRequest: options => ipcRenderer.send('cancelCurlRequest', options),
};

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('main', main);
} else {
  window.curl = main;
}

window.onmessage = (ev: MessageEvent) => {
  if (ev.data === 'message-event://preload/publish-port') {
    ipcRenderer.postMessage('ipc://main/publish-port', null, [ev.ports[0]]);
  }
  console.log('[preload-hidden-browser-win][init hidden win step 3/6]: ipc "publishing port to the main renderer" is ready');
};
