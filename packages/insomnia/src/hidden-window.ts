import { RequestContext } from './hidden-window-preload';

export interface HiddenBrowserWindowBridgeAPI {
  runPreRequestScript: (options: { script: string; context: RequestContext }) => Promise<RequestContext>;
};

window.bridge.onmessage(async (data, callback) => {
  console.log('[hidden-browser-window] recieved message', data);
  try {
    const result = await runPreRequestScript(data);
    callback(result);
  } catch (err) {
    console.error('error', err);
    callback({ error: err.message });
  }
});
const runPreRequestScript = async ({ script, context }: { script: string; context: RequestContext }): Promise<RequestContext> => {
  console.log(script);
  const executionContext = {
    request: {
      addHeader: (v: string) => context.request.headers.push({ name: v.split(':')[0], value: v.split(':')[1] }),
    },
  };

  const log: string[] = [];
  const consoleInterceptor = {
    log: (...args: any[]) => log.push(JSON.stringify({ value: args.map(a => JSON.stringify(a)).join('\n'), name: 'Text', timestamp: Date.now() }) + '\n'),
  };

  const AsyncFunction = (async () => { }).constructor;
  const executeScript = AsyncFunction(
    'insomnia',
    'require',
    'console',
    `
      const $ = insomnia, pm = insomnia;
       ${script};
      return insomnia;`
  );

  const mutatedInsomniaObject = await executeScript(
    executionContext,
    window.bridge.requireInterceptor,
    consoleInterceptor
  );

  await window.bridge.requireInterceptor('fs').promises.writeFile(context.timelinePath, log.join('\n'));
  console.log('mutatedInsomniaObject', mutatedInsomniaObject);
  console.log('context', context);
  return context;
};
