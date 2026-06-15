import fs from 'node:fs/promises';
import path from 'node:path';

import type { BaseModel, Environment, Settings, UserUploadEnvironment } from 'insomnia-data';
import { database, initDatabase, services } from 'insomnia-data';
import { createNedbDatabase } from 'insomnia-data/node';

import {
  defaultSendActionRuntime,
  fetchRequestData,
  responseTransform,
  sendCurlAndWriteTimeline,
  tryToExecuteAfterResponseScript,
  tryToExecutePreRequestScript,
  tryToInterpolateRequest,
} from './network';

// The network layer uses settings from the settings model
// We want to give consumers the ability to override certain settings
interface SettingsOverride {
  validateSSL?: Settings['validateSSL'];
  dataFolders?: Settings['dataFolders'];
  timeout?: Settings['timeout'];
}
const wrapAroundIterationOverIterationData = (
  list?: UserUploadEnvironment[],
  currentIteration?: number,
): UserUploadEnvironment | undefined => {
  if (currentIteration === undefined || !Array.isArray(list) || list.length === 0) {
    return undefined;
  }
  if (list.length >= currentIteration + 1) {
    return list[currentIteration];
  }
  return list[(currentIteration + 1) % list.length];
};

export async function getSendRequestCallbackMemDb(
  environmentId: string,
  memDB: any,
  transientVariables: Environment,
  settingsOverrides?: SettingsOverride,
  iterationData?: UserUploadEnvironment[],
  iterationCount?: number,
) {
  // Initialize the DB in-memory and fill it with data if we're given one
  await initDatabase(
    createNedbDatabase(),
    {
      inMemoryOnly: true,
    },
    true,
  );

  // First, upsert all docs from memDB (which may include Settings from fixtures)
  const docs: BaseModel[] = [];
  for (const type of Object.keys(memDB)) {
    for (const doc of memDB[type]) {
      docs.push(doc);
    }
  }
  await database.batchModifyDocs({
    upsert: docs,
    remove: [],
  });

  // Now get settings (may come from fixtures) and merge with overrides
  const settings = await services.settings.getOrCreate();
  const mergedSettings = { ...settings, ...settingsOverrides };
  await database.batchModifyDocs({
    upsert: [mergedSettings],
    remove: [],
  });

  // Return callback helper to send requests
  return async function sendRequest(requestId: string, iteration?: number) {
    const requestData = await fetchRequestData(requestId, environmentId);
    const getCurrentRowOfIterationData = wrapAroundIterationOverIterationData(iterationData, iteration);
    await fs.mkdir(path.dirname(requestData.timelinePath), { recursive: true });

    const mutatedContext = await tryToExecutePreRequestScript(
      requestData,
      transientVariables,
      getCurrentRowOfIterationData,
      iteration,
      iterationCount,
    );
    if (mutatedContext === null) {
      console.error('Time out while executing pre-request script');
      return null;
    }
    const ignoreUndefinedEnvVariable = true;
    // NOTE: inso ignores active environment, using the one passed in
    const renderedResult = await tryToInterpolateRequest({
      request: mutatedContext.request,
      environment: mutatedContext.environment,
      purpose: 'send',
      extraInfo: undefined,
      transientVariables: mutatedContext.transientVariables || transientVariables,
      baseEnvironment: mutatedContext.baseEnvironment,
      userUploadEnvironment: mutatedContext.userUploadEnvironment,
      ignoreUndefinedEnvVariable,
    });
    // skip plugins
    const renderedRequest = renderedResult.request;

    const response = await sendCurlAndWriteTimeline(
      renderedRequest,
      mutatedContext.clientCertificates,
      requestData.caCert,
      mutatedContext.settings,
      requestData.timelinePath,
      requestData.responseId,
    );
    const res = await responseTransform(response, environmentId, renderedRequest, renderedResult.context);

    if (res.error) {
      throw new Error(res.error);
    }

    const postMutatedContext = await tryToExecuteAfterResponseScript({
      ...requestData,
      ...mutatedContext,
      runtime: defaultSendActionRuntime,
      transientVariables: mutatedContext.transientVariables || transientVariables,
      response,
    });
    if ('error' in postMutatedContext) {
      console.error(
        '[network] An error occurred while running after-response script for request named:',
        renderedRequest.name,
      );
      throw new Error(postMutatedContext.error);
    }
    const { statusCode: status, statusMessage, headers: headerArray, elapsedTime: responseTime } = res;

    const headers = headerArray?.reduce<Record<string, string>>(
      (acc, { name, value }) => ({ ...acc, [name.toLowerCase() || '']: value || '' }),
      {},
    );
    const bodyBuffer = (await services.helpers.getResponseBodyBuffer(res)) as Buffer;
    const data = bodyBuffer ? bodyBuffer.toString('utf8') : undefined;

    const testResults = [
      ...(mutatedContext.requestTestResults || []),
      ...(postMutatedContext.requestTestResults || []),
    ];
    return {
      status,
      statusMessage,
      data,
      headers,
      responseTime,
      timelinePath: requestData.timelinePath,
      testResults,
      nextRequestIdOrName: postMutatedContext?.execution?.nextRequestIdOrName,
    };
  };
}
