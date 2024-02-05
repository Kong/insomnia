const { ipcRenderer } = require('electron');

window.onmessage = ev => {
  if (ev.data === 'message-event://preload/publish-port') {
    ipcRenderer.postMessage('ipc://main/publish-port', null, [ev.ports[0]]);
  }
  console.log('[preload-hidden-browser-win][init hidden win step 3/6]: ipc "publishing port to the main renderer" is ready');
};
