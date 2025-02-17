import * as Sentry from '@sentry/electron/renderer';
import { SENTRY_OPTIONS } from 'insomnia/src/common/sentry';
import { initInsomniaObject, InsomniaObject } from 'insomnia-sdk';
import { getNewConsole, mergeClientCertificates, mergeCookieJar, mergeRequests, mergeSettings, type RequestContext } from 'insomnia-sdk';
import * as _ from 'lodash';

export interface HiddenBrowserWindowBridgeAPI {
  runScript: (options: { script: string; context: RequestContext }) => Promise<RequestContext>;
};

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
    const errMessage = err.message ? `message: ${err.message}; stack: ${err.stack}` : err;
    Sentry.captureException(errMessage, {
      tags: {
        source: 'hidden-window',
      },
    });
    callback({ error: errMessage });
  } finally {
    window.bridge.setBusy(false);
  }
});

// as insomnia.test accepts an async function, prepend await to it as user don't write it
function translateTestHandlers(script: string): string {
  const replacedTests = script.replace(/insomnia\.test\(/g, 'await insomnia.test(');
  return replacedTests.replace(/insomnia\.test\.skip\(/g, 'await insomnia.test.skip(');
}

// This function is duplicated in scriptExecutor.ts to run in nodejs
// TODO: consider removing this implementation and using only nodejs scripting
const runScript = async (
  { script, context }: { script: string; context: RequestContext },
): Promise<RequestContext> => {
  const scriptConsole = getNewConsole();

  const executionContext = await initInsomniaObject(context, scriptConsole.log);

  const translatedScript = translateTestHandlers(script);
  const AsyncFunction = (async () => { }).constructor;
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
    `
      const $ = insomnia;
      window.bridge.resetAsyncTasks(); // exclude unnecessary ones
      ${translatedScript};
      window.bridge.stopMonitorAsyncTasks();  // the next one should not be monitored
      await window.bridge.asyncTasksAllSettled();
      return insomnia;`
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
  );
  if (mutatedInsomniaObject == null || !(mutatedInsomniaObject instanceof InsomniaObject)) {
    throw Error('insomnia object is invalid or script returns earlier than expected.');
  }
  const mutatedContextObject = mutatedInsomniaObject.toObject();
  const updatedRequest = mergeRequests(context.request, mutatedContextObject.request);
  const updatedSettings = mergeSettings(context.settings, mutatedContextObject.request);
  const updatedCertificates = mergeClientCertificates(mutatedContextObject.clientCertificates, mutatedContextObject.request);
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
    iterationData: context.iterationData ? {
      name: context.iterationData.name,
      data: mutatedContextObject.iterationData,
    } : undefined,
    transientVariables: {
      name: context.transientVariables?.name || 'transientVariables',
      data: mutatedContextObject.variables,
    },
    request: updatedRequest,
    execution: mutatedContextObject.execution,
    settings: updatedSettings,
    clientCertificates: updatedCertificates,
    cookieJar: updatedCookieJar,
    globals: mutatedContextObject.globals,
    requestTestResults: mutatedContextObject.requestTestResults,
    logs: scriptConsole.dumpLogsAsArray(),
    parentFolders: mutatedContextObject.parentFolders,
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
