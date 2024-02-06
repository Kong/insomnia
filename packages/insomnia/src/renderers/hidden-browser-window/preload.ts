import crypto from 'crypto';
import { contextBridge, ipcRenderer } from 'electron';
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
              return crypto.createHash(algorithm).update(data, inputEncoding).digest(outputEncoding);
            },
          };
        },
      };
    },
  },
  runPreRequestScript: (script, context) => {
    // TODO: return error here and show in timeline
    console.log(script);
    return context.request;
  },
};
if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('bridge', bridge);
} else {
  window.bridge = bridge;
}
