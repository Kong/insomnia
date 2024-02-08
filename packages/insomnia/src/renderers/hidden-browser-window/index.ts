import type { Request } from '../../models/request';
import { invariant } from '../../utils/invariant';

declare global {
  interface Window {
    bridge: {
      on: (channel: string, listener: (event: any) => void) => () => void;
      runPreRequestScript: (script: string, data: RequestContext) => Promise<RequestContext>;
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
  runPreRequestScript: ({ script, context }) => {
    return window.bridge.runPreRequestScript(script, context);
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
