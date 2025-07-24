import * as Sentry from '@sentry/electron/renderer';
import * as _ from 'es-toolkit/compat';
import { SENTRY_OPTIONS } from 'insomnia/src/common/sentry';

import {
  initInsomniaObject,
  InsomniaObject,
  waitForAllTestsDone,
} from '../../insomnia-scripting-environment/src/objects';
import {
  getNewConsole,
  mergeClientCertificates,
  mergeCookieJar,
  mergeRequests,
  mergeSettings,
  type RequestContext,
} from '../../insomnia-scripting-environment/src/objects';

export interface HiddenBrowserWindowBridgeAPI {
  runScript: (options: { script: string; context: RequestContext }) => Promise<RequestContext>;
}

Sentry.init({
  ...SENTRY_OPTIONS,
});

window.bridge.onmessage(async (data, callback) => {
  window.bridge.setBusy(true);

  try {
    const timeout = data.context.timeout || 5000;
    const timeoutPromise = new window.bridge.Promise(resolve => {
      setTimeout(() => {
        resolve({ error: 'Timeout: Running script took too long' });
      }, timeout);
    });
    const result = await window.bridge.Promise.race([timeoutPromise, runScript(data)]);
    callback(result);
  } catch (err) {
    const errMessage = err.message ? `Error from Pre-request or after-response script:\n${err.message};` : err;
    const errStack = err.stack ? `Stack: ${err.stack};` : '';
    const fullErrMessage = `${errMessage}\n${errStack}`;
    Sentry.captureException(errMessage, {
      tags: {
        source: 'hidden-window',
      },
    });
    callback({ error: fullErrMessage });
  } finally {
    window.bridge.setBusy(false);
  }
});

// This function is duplicated in scriptExecutor.ts to run in nodejs
// TODO: consider removing this implementation and using only nodejs scripting
const runScript = async ({ script, context }: { script: string; context: RequestContext }): Promise<RequestContext> => {
  const scriptConsole = getNewConsole();

  const executionContext = await initInsomniaObject(context, scriptConsole.log);

  const AsyncFunction = (async () => {}).constructor;
  const executeScript = AsyncFunction(
    'insomnia',
    'require',
    'console',
    '_',
    'setTimeout',
    // disable these as they are not supported in web or existing implementation
    'setImmediate',
    'queueMicrotask',
    'process',
    'waitForAllTestsDone',
    `
      const $ = insomnia;
      window.bridge.resetAsyncTasks(); // exclude unnecessary ones
      ${script};
      await waitForAllTestsDone();
      window.bridge.stopMonitorAsyncTasks();  // the next one should not be monitored
      await window.bridge.asyncTasksAllSettled();
      return insomnia;`,
  );

  const mutatedInsomniaObject = await executeScript(
    executionContext,
    window.bridge.requireInterceptor,
    scriptConsole,
    _,
    proxiedSetTimeout,
    undefined,
    undefined,
    undefined,
    waitForAllTestsDone,
  );
  if (mutatedInsomniaObject == null || !(mutatedInsomniaObject instanceof InsomniaObject)) {
    throw new Error('insomnia object is invalid or script returns earlier than expected.');
  }
  const mutatedContextObject = mutatedInsomniaObject.toObject();
  const updatedRequest = mergeRequests(context.request, mutatedContextObject.request);
  const updatedSettings = mergeSettings(context.settings, mutatedContextObject.request);
  const updatedCertificates = mergeClientCertificates(
    mutatedContextObject.clientCertificates,
    mutatedContextObject.request,
  );
  const updatedCookieJar = mergeCookieJar(context.cookieJar, mutatedContextObject.cookieJar);

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
    iterationData: context.iterationData
      ? {
          name: context.iterationData.name,
          data: mutatedContextObject.iterationData,
        }
      : undefined,
    transientVariables: {
      name: context.transientVariables?.name || 'transientVariables',
      data: mutatedContextObject.variables,
    },
    request: updatedRequest,
    execution: mutatedContextObject.execution,
    settings: updatedSettings,
    clientCertificates: updatedCertificates,
    cookieJar: updatedCookieJar,
    globals: context.globals && {
      id: context.globals.id,
      name: context.globals.name,
      data: mutatedContextObject.globals,
    },
    baseGlobals: context.baseGlobals && {
      id: context.baseGlobals.id,
      name: context.baseGlobals.name,
      data: mutatedContextObject.baseGlobals,
    },
    requestTestResults: mutatedContextObject.requestTestResults,
    logs: scriptConsole.dumpLogsAsArray(),
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
