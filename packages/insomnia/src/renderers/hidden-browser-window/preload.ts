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
  runPreRequestScript: async (script, context) => {
    // TODO: return error here and show in timeline
    console.log(script);
    const AsyncFunction = (async () => { }).constructor;
    const executeScript = AsyncFunction(
      'insomnia',
      // if possible, avoid adding code to the following part
      `
                        const $ = insomnia, pm = insomnia;
                        ${script};
                        return insomnia;
                    `
    );
    return await executeScript(context);
  },
};
if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('bridge', bridge);
} else {
  window.bridge = bridge;
}
