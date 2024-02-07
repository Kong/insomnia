import { contextBridge, ipcRenderer } from 'electron';

const requirePolyfill = (moduleName: string) => {
  if (['uuid', 'crypto'].includes(moduleName)) {
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
                        const patchlog = (...args)=>insomnia.log.push(args.map(a=>JSON.stringify(a)).join(' '))
                        console={log:patchlog,error:patchlog,warn:patchlog,info:patchlog,debug:patchlog};
                        ${script};
                        return insomnia;
                    `
    );
    const mutated = await executeScript(executionContext, requirePolyfill);
    console.log({ mutated });

    return requestContext;
  },
};
if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('bridge', bridge);
} else {
  window.bridge = bridge;
}
