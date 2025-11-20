import { appendFile } from 'node:fs/promises';

import * as _ from 'es-toolkit/compat';

import { initInsomniaObject, InsomniaObject } from '../../insomnia-scripting-environment/src/objects';
import {
  getNewConsole,
  mergeClientCertificates,
  mergeCookieJar,
  mergeRequests,
  mergeSettings,
  type RequestContext,
} from '../../insomnia-scripting-environment/src/objects';
import { requireInterceptor } from './require-interceptor';
import { invariant } from './utils/invariant';

export const runScript = async ({
  script,
  context,
}: {
  script: string;
  context: RequestContext;
}): Promise<RequestContext> => {
  // console.log(script);
  const scriptConsole = getNewConsole();

  const executionContext = await initInsomniaObject(context, scriptConsole.log);

  const evalInterceptor = (script: string) => {
    invariant(script && typeof script === 'string', 'eval is called with invalid or empty value');
    const result = eval(script);
    return result;
  };

  const AsyncFunction = (async () => {}).constructor;
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
      return insomnia;`,
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
    throw new Error('insomnia object is invalid or script returns earlier than expected.');
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
    transientVariables: {
      name: context.transientVariables?.name || 'transientVariables',
      data: mutatedContextObject.variables,
    },
    request: updatedRequest,
    settings: updatedSettings,
    clientCertificates: updatedCertificates,
    cookieJar: updatedCookieJar,
    globals: context.globals && {
      id: context.environment.id,
      name: context.environment.name,
      data: mutatedContextObject.globals,
    },
    baseGlobals: context.baseGlobals && {
      id: context.baseEnvironment.id,
      name: context.baseEnvironment.name,
      data: mutatedContextObject.baseGlobals,
    },
    requestTestResults: mutatedContextObject.requestTestResults,
    execution: mutatedContextObject.execution,
    parentFolders: mutatedContextObject.parentFolders,
  };
};

// proxiedSetTimeout has to be here as callback could be an async task
function proxiedSetTimeout(callback: () => void, ms?: number | undefined) {
  let resolveHdl: (value: unknown) => void;

  new Promise(resolve => {
    resolveHdl = resolve;
  });

  return setTimeout(() => {
    callback();
    resolveHdl(null);
  }, ms);
}
