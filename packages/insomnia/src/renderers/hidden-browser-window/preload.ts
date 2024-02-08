import { contextBridge, ipcRenderer } from 'electron';
import fs from 'fs';
const requirePolyfill = (moduleName: string) => {
  if (['uuid', 'crypto', 'fs'].includes(moduleName)) {
    return require(moduleName);
  }
  throw Error(`no module is found for "${moduleName}"`);
};

const bridge: Window['bridge'] = {
  on: (channel, listener) => {
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },
  runPreRequestScript: async (script, requestContext) => {
    console.log(script);
    const executionContext = {
      request: {
        addHeader: (v: string) => requestContext.request.headers.push({ name: v.split(':')[0], value: v.split(':')[1] }),
      },
    };
    const AsyncFunction = (async () => { }).constructor;
    const executeScript = AsyncFunction(
      'insomnia',
      'require',
      `
                        const $ = insomnia, pm = insomnia;
                         ${script};
                        return insomnia;
                    `
    );

    const mutated = await executeScript(executionContext, requirePolyfill);
    // mutated.log.push(JSON.stringify({ value: 'Ran pre request script', name: 'Text', timestamp: Date.now() }) + '\n');
    console.log({ mutated, requestContext });
    // console.log('wrote to', requestContext.timelinePath, mutated.log.join('\n'));
    // await fs.promises.writeFile(requestContext.timelinePath, mutated.log.join('\n'));
    await fs.promises.appendFile(requestContext.timelinePath, JSON.stringify({ value: 'proof that it works', name: 'Text', timestamp: Date.now() }) + '\n');
    return requestContext;
  },
};
if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('bridge', bridge);
} else {
  window.bridge = bridge;
}
