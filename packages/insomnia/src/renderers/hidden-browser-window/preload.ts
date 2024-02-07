import { contextBridge, ipcRenderer } from 'electron';

const requirePolyfill = (moduleName: string) => {
  if (['uuid'].includes(moduleName)) {
    return require(moduleName);
  }
  throw Error(`no module is found for "${moduleName}"`);
};

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
      log: data.log,
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
    const mutatedContext = await executeScript(executionContext, requirePolyfill);
    data.log = mutatedContext.log;
    console.log({ mutatedContext });

    return data;
  },
};
if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('bridge', bridge);
} else {
  window.bridge = bridge;
}
