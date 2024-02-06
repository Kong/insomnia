import type { Request } from '../../models/request';
import { invariant } from '../../utils/invariant';

declare global {
  interface Window {
    bridge: {
      on: (channel: string, listener: (event: any) => void) => () => void;
      crypto: {
        createHash: (algorithm: string) => {
          update: (value: string, encoding: string) => {
            digest: (encoding: string) => string;
          };
        };
      };
      runPreRequestScript: (script: string, data: { request: Request }) => Promise<{ request: Request }>;
    };
  }
}

export interface HiddenBrowserWindowBridgeAPI {
  createHash: (options: { value: string; algorithm: string; encoding: string }) => Promise<string>;
  runPreRequestScript: (options: { script: string; context: { request: Request } }) => Promise<{ request: Request }>;
};

const work: HiddenBrowserWindowBridgeAPI = {
  createHash: async ({ value, algorithm, encoding }) => {
    return window.bridge.crypto.createHash(algorithm || 'md5')
      .update(value || '', 'utf8')
      .digest(encoding || 'hex');
  },

  runPreRequestScript: ({ script, context }) => {
    return window.bridge.runPreRequestScript(script, context);
  },
};
window.bridge.on('new-client', async (event: MessageEvent) => {
  const [port] = event.ports;
  console.log('opened port to insomnia renderer');
  port.onmessage = async event => {
    try {
      invariant(event.data.type, 'Missing work type');
      const workType: 'createHash' | 'runPreRequestScript' = event.data.type;
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
