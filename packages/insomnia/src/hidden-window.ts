import { initInsomniaObject, InsomniaObject } from 'insomnia-sdk';
import { Console, mergeClientCertificates, mergeCookieJar, mergeRequests, mergeSettings, RequestContext } from 'insomnia-sdk';
import * as _ from 'lodash';

import { invariant } from '../src/utils/invariant';

export interface HiddenBrowserWindowBridgeAPI {
  runPreRequestScript: (options: { script: string; context: RequestContext }) => Promise<RequestContext>;
};

window.bridge.onmessage(async (data, callback) => {
  window.bridge.setBusy(true);
  console.log('[hidden-browser-window] recieved message', data);
  try {
    const timeout = data.context.timeout || 5000;
    const timeoutPromise = new window.bridge.Promise(resolve => {
      setTimeout(() => {
        resolve({ error: 'Timeout: Pre-request script took too long' });
      }, timeout);
    });
    const result = await window.bridge.Promise.race([timeoutPromise, runPreRequestScript(data)]);
    callback(result);
  } catch (err) {
    console.error('error', err);
    callback({ error: err.message });
  } finally {
    window.bridge.setBusy(false);
  }
});

const runPreRequestScript = async (
  { script, context }: { script: string; context: RequestContext },
): Promise<RequestContext> => {
  console.log(script);
  const scriptConsole = new Console();

  const executionContext = initInsomniaObject(context, scriptConsole.log);

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
    '_',
    'setTimeout',
    // disable these as they are not supported in web or existing implementation
    'setImmediate',
    'queueMicrotask',
    'process',
    `
      const $ = insomnia;
      window.bridge.resetAsyncTasks(); // exclude unnecessary ones
      ${script};
      window.bridge.stopMonitorAsyncTasks();  // the next one should not be monitored
      await window.bridge.asyncTasksAllSettled();
      return insomnia;`
  );

  const mutatedInsomniaObject = await executeScript(
    executionContext,
    window.bridge.requireInterceptor,
    scriptConsole,
    evalInterceptor,
    _,
    proxiedSetTimeout,
    undefined,
    undefined,
    undefined,
  );
  if (mutatedInsomniaObject == null || !(mutatedInsomniaObject instanceof InsomniaObject)) {
    throw Error('insomnia object is invalid or script returns earlier than expected.');
  }
  const mutatedContextObject = mutatedInsomniaObject.toObject();
  const updatedRequest = mergeRequests(context.request, mutatedContextObject.request);
  const updatedSettings = mergeSettings(context.settings, mutatedContextObject.request);
  const updatedCertificates = mergeClientCertificates(context.clientCertificates, mutatedContextObject.request);
  const updatedCookieJar = mergeCookieJar(context.cookieJar, mutatedContextObject.cookieJar);

  await window.bridge.writeFile(context.timelinePath, scriptConsole.dumpLogs());

  console.log('mutatedInsomniaObject', mutatedContextObject);
  console.log('context', context);

  return {
    ...context,
    environment: mutatedContextObject.environment,
    baseEnvironment: mutatedContextObject.baseEnvironment,
    request: updatedRequest,
    settings: updatedSettings,
    clientCertificates: updatedCertificates,
    cookieJar: updatedCookieJar,
  };
};

// proxiedSetTimeout has to be here as callback could be an async task
function proxiedSetTimeout(
  callback: () => void,
  ms?: number | undefined,
) {
  let resolveHdl: (value: unknown) => void;

  new Promise(resolve => {
    resolveHdl = resolve;
  });

  return setTimeout(
    () => {
      try {
        callback();
        resolveHdl(null);
      } catch (e) {
        throw e;
      }
    },
    ms,
  );
}
