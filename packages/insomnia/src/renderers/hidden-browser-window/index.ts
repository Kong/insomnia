import type { Request } from '../../models/request';
import { invariant } from '../../utils/invariant';

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

const work: HiddenBrowserWindowBridgeAPI = {
  runPreRequestScript: async ({ script, context }) => {
    console.log(script);
    const executionContext = {
      request: {
        addHeader: (v: string) => context.request.headers.push({ name: v.split(':')[0], value: v.split(':')[1] }),
      },
    };

    const log = [];
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
                        // const originalConsole = console;
                        // const console = {
                        //     log: (...args) => {
                        //         originalConsole.log(...args);
                        //         insomnia.log.push(args.join(' '));
                        //     },
                        //   };
                        //   console = originalConsole;
                         ${script};
                        return insomnia;
                    `
    );

    const mutated = await executeScript(executionContext, window.bridge.requirePolyfill, consolePolyfill);
    await window.bridge.requirePolyfill('fs').promises.writeFile(context.timelinePath, log.join('\n'));
    return context;
  },
};
window.bridge.on('renderer-listener', async (event: MessageEvent) => {
  const [port] = event.ports;
  console.log('opened port to insomnia renderer');
  port.onmessage = async event => {
    try {
      // TODO: consider removing this early abstraction
      invariant(event.data.type, 'Missing work type');
      const workType: 'runPreRequestScript' = event.data.type;
      invariant(work[workType], `Unknown work type ${workType}`);
      const result = await work[workType](event.data);
      console.log('got', { input: event.data, result });
      port.postMessage(result);
    } catch (err) {
      console.error('error', err);
      port.postMessage({ error: err.message });
    }
  };
});
