import type { Request } from '../../models/request';

declare global {
  interface Window {
    bridge: {
      on: (channel: string, listener: (event: any) => void) => () => void;
      requirePolyfill: (module: string) => any;
    };
  }
}
interface RequestContext {
  request: Request;
  timelinePath: string;
}
export interface HiddenBrowserWindowBridgeAPI {
  runPreRequestScript: (options: { script: string; context: RequestContext }) => Promise<RequestContext>;
};

const runPreRequestScript = async ({ script, context }: { script: string; context: RequestContext }): Promise<RequestContext> => {
  console.log(script);
  const executionContext = {
    request: {
      addHeader: (v: string) => context.request.headers.push({ name: v.split(':')[0], value: v.split(':')[1] }),
    },
  };

  const log: string[] = [];
  const consolePolyfill = {
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

  const mutatedInsomniaObject = await executeScript(executionContext,
    window.bridge.requirePolyfill,
    consolePolyfill);
  await window.bridge.requirePolyfill('fs').promises.writeFile(context.timelinePath, log.join('\n'));
  console.log('mutatedInsomniaObject', mutatedInsomniaObject);
  console.log('context', context);
  return context;
};

window.bridge.on('renderer-listener', async (event: MessageEvent) => {
  const [port] = event.ports;
  console.log('opened port to insomnia renderer');
  port.onmessage = async event => {
    try {
      const result = await runPreRequestScript(event.data);
      console.log('got', { input: event.data, result });
      port.postMessage(result);
    } catch (err) {
      console.error('error', err);
      port.postMessage({ error: err.message });
    }
  };
});
