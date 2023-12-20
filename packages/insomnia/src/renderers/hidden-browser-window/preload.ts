import { ipcRenderer } from 'electron';

window.onmessage = (ev: MessageEvent) => {
  if (ev.data === 'message-event://preload/publish-port') {
    ipcRenderer.postMessage('ipc://main/publish-port', null, [ev.ports[0]]);
  }
};
