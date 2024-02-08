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

    const mutated = await executeScript(executionContext, window.bridge.requirePolyfill);
    // mutated.log.push(JSON.stringify({ value: 'Ran pre request script', name: 'Text', timestamp: Date.now() }) + '\n');
    console.log({ mutated, context });
    // console.log('wrote to', context.timelinePath, mutated.log.join('\n'));
    // await fs.promises.writeFile(context.timelinePath, mutated.log.join('\n'));
    await window.bridge.requirePolyfill('fs').promises.appendFile(context.timelinePath, JSON.stringify({ value: 'proof that it works', name: 'Text', timestamp: Date.now() }) + '\n');
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
