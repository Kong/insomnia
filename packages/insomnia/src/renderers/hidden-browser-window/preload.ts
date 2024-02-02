import { contextBridge, ipcRenderer } from 'electron';

const curl: Window['curl'] = {
  curlRequest: options => ipcRenderer.invoke('curlRequest', options),
  cancelCurlRequest: options => ipcRenderer.send('cancelCurlRequest', options),
  readCurlResponse: options => ipcRenderer.invoke('readCurlResponse', options),
};

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('curl', curl);
} else {
  window.curl = curl;
}

window.onmessage = (ev: MessageEvent) => {
  if (ev.data === 'message-event://preload/publish-port') {
    ipcRenderer.postMessage('ipc://main/publish-port', null, [ev.ports[0]]);
  }
  console.log('[preload-hidden-browser-win][init hidden win step 3/6]: ipc "publishing port to the main renderer" is ready');
};
