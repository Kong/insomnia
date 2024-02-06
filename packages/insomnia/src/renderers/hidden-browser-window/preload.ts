import crypto, { type BinaryToTextEncoding, type Encoding } from 'crypto';
import { contextBridge, ipcRenderer } from 'electron';
const bridge: Window['bridge'] = {
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
              return crypto.createHash(algorithm).update(data, inputEncoding as Encoding).digest(outputEncoding as BinaryToTextEncoding);
            },
          };
        },
      };
    },
  },
  runPreRequestScript: async (script, data) => {
  // TODO: return error here and/or write to timeline file
    console.log(script);
    const executionContext = {
      request: {
        addHeader: (v: string) => data.request.headers.push({ name: v.split(':')[0], value: v.split(':')[1] }),
      },
    };
    const AsyncFunction = (async () => { }).constructor;
    const executeScript = AsyncFunction(
      'insomnia',
      `
                        const $ = insomnia, pm = insomnia;
                        ${script};
                        return insomnia;
                    `
    );
    const mutatedContext = await executeScript(executionContext);
    console.log({ mutatedContext });
    return data;
  },
};
if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('bridge', bridge);
} else {
  window.bridge = bridge;
}
