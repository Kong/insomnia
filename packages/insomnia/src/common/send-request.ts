import fs from 'fs/promises';
import path from 'path';

import { type BaseModel, types as modelTypes } from '../models';
import * as models from '../models';
import type { Environment, UserUploadEnvironment } from '../models/environment';
import type { Request } from '../models/request';
import type { RequestGroup } from '../models/request-group';
import { getBodyBuffer } from '../models/response';
import type { Settings } from '../models/settings';
import { isWorkspace, type Workspace } from '../models/workspace';
import {
  responseTransform,
  sendCurlAndWriteTimeline,
  tryToExecuteAfterResponseScript,
  tryToExecutePreRequestScript,
  tryToInterpolateRequest,
} from '../network/network';
import { defaultSendActionRuntime } from '../ui/routes/request';
import { invariant } from '../utils/invariant';
import { database } from './database';
import { generateId } from './misc';

// The network layer uses settings from the settings model
// We want to give consumers the ability to override certain settings
type SettingsOverride = Pick<Settings, 'validateSSL'>;
const wrapAroundIterationOverIterationData = (list?: UserUploadEnvironment[], currentIteration?: number): UserUploadEnvironment | undefined => {
  if (currentIteration === undefined || !Array.isArray(list) || list.length === 0) {
    return undefined;
  }
  if (list.length >= currentIteration + 1) {
    return list[currentIteration];
  };
  return list[(currentIteration + 1) % list.length];
};

export async function getSendRequestCallbackMemDb(environmentId: string, memDB: any, transientVariables: Environment, settingsOverrides?: SettingsOverride, iterationData?: UserUploadEnvironment[], iterationCount?: number) {
  // Initialize the DB in-memory and fill it with data if we're given one
  await database.init(
    modelTypes(),
    {
      inMemoryOnly: true,
    },
    true,
    () => { },
  );
  const docs: BaseModel[] = [];

  const settings = await models.settings.getOrCreate();
  docs.push({ ...settings, ...settingsOverrides });

  for (const type of Object.keys(memDB)) {
    for (const doc of memDB[type]) {
      docs.push(doc);
    }
  }

  await database.batchModifyDocs({
    upsert: docs,
    remove: [],
  });
  // This is separate to the fetchRequestData because it overrides environmentId
  const fetchInsoRequestData = async (requestId: string, overrideEnvironmentId: string) => {
    const request = await models.request.getById(requestId);
    invariant(request, 'failed to find request');
    const ancestors = await database.withAncestors<Request | RequestGroup | Workspace>(request, [
      models.request.type,
      models.requestGroup.type,
      models.workspace.type,
    ]);

    const workspaceDoc = ancestors.find(isWorkspace);
    const workspaceId = workspaceDoc ? workspaceDoc._id : 'n/a';
    const workspace = await models.workspace.getById(workspaceId);
    invariant(workspace, 'failed to find workspace');

    const settings = await models.settings.get();
    invariant(settings, 'failed to create settings');
    const clientCertificates = await models.clientCertificate.findByParentId(workspaceId);
    const caCert = await models.caCertificate.findByParentId(workspaceId);

    const environment = await models.environment.getById(overrideEnvironmentId);
    invariant(environment, 'failed to find environment ' + overrideEnvironmentId);
    const activeEnvironmentId = overrideEnvironmentId;

    const baseEnvironment = await models.environment.getOrCreateForParentId(workspaceId);
    const cookieJar = await models.cookieJar.getOrCreateForParentId(workspaceId);

    const workspaceMeta = await models.workspaceMeta.getByParentId(workspaceId);
    let activeGlobalEnvironment: Environment | undefined = undefined;
    if (workspaceMeta?.activeGlobalEnvironmentId) {
      activeGlobalEnvironment = await models.environment.getById(workspaceMeta.activeGlobalEnvironmentId) || undefined;
    }

    const responseId = generateId('res');
    const responsesDir = path.join(process.env['INSOMNIA_DATA_PATH'] || (process.type === 'renderer' ? window : require('electron')).app.getPath('userData'), 'responses');
    const timelinePath = path.join(responsesDir, responseId + '.timeline');

    return {
      request,
      settings,
      clientCertificates,
      caCert,
      environment,
      baseEnvironment,
      cookieJar,
      activeGlobalEnvironment,
      activeEnvironmentId,
      workspace,
      timelinePath,
      responseId,
      ancestors,
    };
  };

  // Return callback helper to send requests
  return async function sendRequest(requestId: string, iteration?: number) {
    const requestData = await fetchInsoRequestData(requestId, environmentId);
    const getCurrentRowOfIterationData = wrapAroundIterationOverIterationData(iterationData, iteration);
    await fs.mkdir(path.dirname(requestData.timelinePath), { recursive: true });

    const mutatedContext = await tryToExecutePreRequestScript(requestData, transientVariables, getCurrentRowOfIterationData, iteration, iterationCount);
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
      requestData.responseId
    );
    const res = await responseTransform(response, environmentId, renderedRequest, renderedResult.context);
    const postMutatedContext = await tryToExecuteAfterResponseScript({
      ...requestData,
      ...mutatedContext,
      runtime: defaultSendActionRuntime,
      transientVariables: mutatedContext.transientVariables || transientVariables,
      response,
    });
    // TODO: figure out how to handle this error
    if ('error' in postMutatedContext) {
      console.error('[network] An error occurred while running after-response script for request named:', renderedRequest.name);
      throw {
        error: postMutatedContext.error,
        response: await responseTransform(response, requestData.activeEnvironmentId, renderedRequest, renderedResult.context),
      };
    }
    const { statusCode: status, statusMessage, headers: headerArray, elapsedTime: responseTime } = res;

    const headers = headerArray?.reduce((acc, { name, value }) => ({ ...acc, [name.toLowerCase() || '']: value || '' }), []);
    const bodyBuffer = await getBodyBuffer(res) as Buffer;
    const data = bodyBuffer ? bodyBuffer.toString('utf8') : undefined;

    const testResults = [...(mutatedContext.requestTestResults || []), ...(postMutatedContext.requestTestResults || [])];
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
