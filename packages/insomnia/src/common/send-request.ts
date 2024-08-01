import path from 'path';
import { type BaseModel, types as modelTypes } from '../models';
import * as models from '../models';
import type { Request } from '../models/request';
import type { RequestGroup } from '../models/request-group';
import { getBodyBuffer } from '../models/response';
import type { Settings } from '../models/settings';
import { isWorkspace, type Workspace } from '../models/workspace';
import {
  getOrInheritAuthentication,
  getOrInheritHeaders,
  responseTransform,
  sendCurlAndWriteTimeline,
  tryToExecutePreRequestScript,
  tryToInterpolateRequest,
} from '../network/network';
import { invariant } from '../utils/invariant';
import { database } from './database';
import { generateId } from './misc';

// The network layer uses settings from the settings model
// We want to give consumers the ability to override certain settings
type SettingsOverride = Pick<Settings, 'validateSSL'>;

export async function getSendRequestCallbackMemDb(environmentId: string, memDB: any, settingsOverrides?: SettingsOverride) {
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

    // check for authentication overrides in parent folders
    const requestGroups = ancestors.filter(a => a.type === 'RequestGroup') as RequestGroup[];
    request.authentication = getOrInheritAuthentication({ request, requestGroups });
    request.headers = getOrInheritHeaders({ request, requestGroups });

    const settings = await models.settings.get();
    invariant(settings, 'failed to create settings');
    const clientCertificates = await models.clientCertificate.findByParentId(workspaceId);
    const caCert = await models.caCertificate.findByParentId(workspaceId);

    const environment = await models.environment.getById(overrideEnvironmentId);
    invariant(environment, 'failed to find environment ' + overrideEnvironmentId);
    const activeEnvironmentId = overrideEnvironmentId;

    const responseId = generateId('res');
    const responsesDir = path.join(process.env['INSOMNIA_DATA_PATH'] || (process.type === 'renderer' ? window : require('electron')).app.getPath('userData'), 'responses');
    const timelinePath = path.join(responsesDir, responseId + '.timeline');

    return { request, settings, clientCertificates, caCert, environment, activeEnvironmentId, workspace, timelinePath, responseId };
  };
  // Return callback helper to send requests
  return async function sendRequest(requestId: string) {
    const requestData = await fetchInsoRequestData(requestId, environmentId);

    const mutatedContext = await tryToExecutePreRequestScript(requestData, requestData.workspace._id);

    if (mutatedContext === null) {
      console.error('Failed to execute pre-request script TODO: handle this better');
      return null;
    }
    const ignoreUndefinedEnvVariable = true
    // NOTE: inso ignores active environment, using the one passed in
    const renderedResult = await tryToInterpolateRequest(
      mutatedContext.request,
      mutatedContext.environment,
      'send',
      undefined,
      mutatedContext.baseEnvironment,
      ignoreUndefinedEnvVariable,
    );
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

    const { statusCode: status, statusMessage, headers: headerArray, elapsedTime: responseTime } = res;

    const headers = headerArray?.reduce((acc, { name, value }) => ({ ...acc, [name.toLowerCase() || '']: value || '' }), []);
    const bodyBuffer = await getBodyBuffer(res) as Buffer;
    const data = bodyBuffer ? bodyBuffer.toString('utf8') : undefined;

    return { status, statusMessage, data, headers, responseTime, timelinePath: requestData.timelinePath };
  };
}

