import { initInsomniaObject, InsomniaObject } from './sdk/objects/insomnia';
import { RequestContext } from './sdk/objects/interfaces';
import { mergeClientCertificates, mergeRequests, mergeSettings } from './sdk/objects/request';

export interface HiddenBrowserWindowBridgeAPI {
  runPreRequestScript: (options: { script: string; context: RequestContext }) => Promise<RequestContext>;
};

window.bridge.onmessage(async (data, callback) => {
  console.log('[hidden-browser-window] recieved message', data);
  try {
    const timeout = data.context.timeout || 5000;
    const timeoutPromise = new Promise(resolve => {
      setTimeout(() => {
        resolve({ error: 'Timeout: Pre-request script took too long' });
      }, timeout);
    });
    const result = await Promise.race([timeoutPromise, runPreRequestScript(data)]);
    callback(result);
  } catch (err) {
    console.error('error', err);
    callback({ error: err.message });
  }
});

const runPreRequestScript = async (
  { script, context }: { script: string; context: RequestContext },
): Promise<RequestContext> => {
  console.log(script);

  const executionContext = initInsomniaObject(context);
  const log: string[] = [];
  // TODO: we should at least support info, debug, warn, error
  const consoleInterceptor = {
    log: (...args: any[]) => log.push(
      JSON.stringify({
        value: args.map(a => JSON.stringify(a)).join('\n'),
        name: 'Text',
        timestamp: Date.now(),
      }) + '\n',
    ),
  };

  const evalInterceptor = (script: string) => {
    invariant(script && typeof script === 'string', 'eval is called with invalid or empty value');
    const result = eval(script);
    return result;
  };

  const AsyncFunction = (async () => { }).constructor;
  const executeScript = AsyncFunction(
    'insomnia',
    'require',
    'console',
    'eval',
    `
      const $ = insomnia, pm = insomnia;
       ${script};
      return insomnia;`
  );

  const mutatedInsomniaObject = await executeScript(
    executionContext,
    window.bridge.requireInterceptor,
    consoleInterceptor,
    evalInterceptor,
  );
  if (mutatedInsomniaObject == null || !(mutatedInsomniaObject instanceof InsomniaObject)) {
    throw Error('insomnia object is invalid or script returns earlier than expected.');
  }
  const mutatedContextObject = mutatedInsomniaObject.toObject();
  const updatedRequest = mergeRequests(context.request, mutatedContextObject.request);
  const updatedSettings = mergeSettings(context.settings, mutatedContextObject.request);
  const updatedCertificates = mergeClientCertificates(context.clientCertificates, mutatedContextObject.request);

  await window.bridge.requireInterceptor('fs').promises.writeFile(context.timelinePath, log.join('\n'));

  console.log('mutatedInsomniaObject', mutatedContextObject);
  console.log('context', context);

  return {
    ...context,
    environment: mutatedContextObject.environment,
    baseEnvironment: mutatedContextObject.baseEnvironment,
    request: updatedRequest,
    settings: updatedSettings,
    clientCertificates: updatedCertificates,
  };
};
