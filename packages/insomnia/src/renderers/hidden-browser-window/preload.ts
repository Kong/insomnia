import { contextBridge, ipcRenderer } from 'electron';
const bridge: Window['bridge'] = {
  on: (channel, listener) => {
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },
  runPreRequestScript: async (script, data) => {
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
