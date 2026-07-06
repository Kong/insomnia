import * as _ from 'es-toolkit/compat';

import {
  InsomniaObject,
  mergeClientCertificates,
  mergeCookieJar,
  mergeRequests,
  mergeSettings,
  type RequestContext,
} from '../../../insomnia-scripting-environment/src/objects';
import { defaultSecurityPolicy, prepareSandbox, ScriptSecurityPolicy } from './sandbox';

export const runScript = async ({
  script,
  context,
  securityPolicy = defaultSecurityPolicy,
}: {
  script: string;
  context: RequestContext;
  securityPolicy?: ScriptSecurityPolicy;
}): Promise<RequestContext> => {
  const activePolicy = context.settings.scriptSandboxEnabled !== false ? securityPolicy : new ScriptSecurityPolicy([]);

  const { executionContext, scriptConsole, maskNames, maskValues, bridgeOps } = await prepareSandbox(
    script,
    context,
    activePolicy,
  );

  const AsyncFunction = (async () => {}).constructor;
  const scriptParams = [
    'insomnia', // insomnia scripting API object
    'console', // log console
    '_', // lodash library
    'setTimeout', // proxied setTimeout tracked by the async task monitor
    '__waitForAllTestsDone__', // Drains pm.test() assertions before the script exits
    '__bridgeReset__', // Clears the async task list and re-enables monitoring
    '__bridgeStop__', // Stops recording new promises into the task list
    '__bridgeSettle__', // Awaits all tracked promises before returning
    ...maskNames, // Masked globals from the security policy (e.g. eval → undefined)
  ];
  const strictMode = context.settings.scriptStrictModeEnabled !== false;
  const scriptBody = [
    `__bridgeReset__();`, // Start with a clean async task slate for this script run
    `await (async function() {`, // IIFE gives the user script its own lexical scope
    ...(strictMode ? [`  'use strict';`] : []), // Strict mode: this === undefined, prevents silent errors
    `  const $ = insomnia;`, // Postman-compat alias for the insomnia scripting object
    `  ${script}`, // User script body
    `})();`,
    `await __waitForAllTestsDone__();`, // Wait for all pm.test() callbacks to resolve
    `__bridgeStop__();`, // Stop tracking new promises (user script is done)
    `await __bridgeSettle__();`, // Drain any fire-and-forget promises the script created
    `return insomnia;`, // Return the (possibly mutated) insomnia context
  ].join('\n');

  // const scriptBody = [
  //   `const $ = insomnia;`,
  //   `__bridgeReset__();`,
  //   `try {`,
  //   `  ${script}`,
  //   `  await __waitForAllTestsDone__();`,
  //   `} finally {`,
  //   `  __bridgeStop__();`,
  //   `  await __bridgeSettle__();`,
  //   `}`,
  //   `return insomnia;`,
  // ].join('\n');

  const executeScript = AsyncFunction(...scriptParams, scriptBody);

  const mutatedInsomniaObject = await executeScript(
    executionContext,
    scriptConsole,
    _,
    proxiedSetTimeout,
    bridgeOps.waitForAllTestsDone,
    bridgeOps.resetAsyncTasks,
    bridgeOps.stopMonitorAsyncTasks,
    bridgeOps.asyncTasksAllSettled,
    ...maskValues,
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
