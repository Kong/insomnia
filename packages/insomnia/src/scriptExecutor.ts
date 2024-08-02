import { appendFile } from 'node:fs/promises';

import { initInsomniaObject, InsomniaObject } from 'insomnia-sdk';
import { Console, mergeClientCertificates, mergeCookieJar, mergeRequests, mergeSettings, type RequestContext } from 'insomnia-sdk';
import * as _ from 'lodash';

import { invariant } from '../src/utils/invariant';
import { requireInterceptor } from './requireInterceptor';

export const runScript = async (
  { script, context }: { script: string; context: RequestContext },
): Promise<RequestContext> => {
  // console.log(script);
  const scriptConsole = new Console();

  const executionContext = await initInsomniaObject(context, scriptConsole.log);

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
      ${script};
      return insomnia;`
  );

  const mutatedInsomniaObject = await executeScript(
    executionContext,
    requireInterceptor,
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

  await appendFile(context.timelinePath, scriptConsole.dumpLogs());

  // console.log('mutatedInsomniaObject', mutatedContextObject);
  // console.log('context', context);

  return {
    ...context,
    environment: {
      id: context.environment.id,
      name: context.environment.name,
      data: mutatedContextObject.environment,
    },
    baseEnvironment: {
      id: context.baseEnvironment.id,
      name: context.baseEnvironment.name,
      data: mutatedContextObject.baseEnvironment,
    },
    request: updatedRequest,
    settings: updatedSettings,
    clientCertificates: updatedCertificates,
    cookieJar: updatedCookieJar,
    globals: mutatedContextObject.globals,
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
