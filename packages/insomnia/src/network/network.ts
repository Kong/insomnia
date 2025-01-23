import clone from 'clone';
import fs from 'fs';
import type { ExecutionOption, RequestContext, RequestTestResult } from 'insomnia-sdk';
import orderedJSON from 'json-order';
import { join as pathJoin } from 'path';

import { SINGLE_VALUE_HEADERS } from '../common/common-headers';
import { JSON_ORDER_PREFIX, JSON_ORDER_SEPARATOR } from '../common/constants';
import { database as db } from '../common/database';
import {
  generateId,
  getContentTypeHeader,
  getLocationHeader,
  getSetCookieHeaders,
} from '../common/misc';
import type { ExtraRenderInfo, RenderedRequest, RenderPurpose, RequestAndContext } from '../common/render';
import {
  getRenderedRequestAndContext,
  RENDER_PURPOSE_NO_RENDER,
} from '../common/render';
import type { HeaderResult, ResponsePatch, ResponseTimelineEntry } from '../main/network/libcurl-promise';
import * as models from '../models';
import type { CaCertificate } from '../models/ca-certificate';
import type { ClientCertificate } from '../models/client-certificate';
import type { Cookie, CookieJar } from '../models/cookie-jar';
import { type Environment, EnvironmentType, getKVPairFromData, type UserUploadEnvironment } from '../models/environment';
import type { MockRoute } from '../models/mock-route';
import type { MockServer } from '../models/mock-server';
import { isProject, type Project } from '../models/project';
import { type BaseRequest, isRequest, type Request, type RequestAuthentication, type RequestHeader, type RequestParameter } from '../models/request';
import { isRequestGroup, type RequestGroup } from '../models/request-group';
import type { Settings } from '../models/settings';
import type { WebSocketRequest } from '../models/websocket-request';
import { isWorkspace, type Workspace } from '../models/workspace';
import * as pluginContexts from '../plugins/context/index';
import * as plugins from '../plugins/index';
import { defaultSendActionRuntime, type SendActionRuntime } from '../ui/routes/request';
import { invariant } from '../utils/invariant';
import { serializeNDJSON } from '../utils/ndjson';
import {
  buildQueryStringFromParams,
  joinUrlAndQueryString,
  smartEncodeUrl,
} from '../utils/url/querystring';
import { getAuthHeader, getAuthObjectOrNull, getAuthQueryParams, isAuthEnabled } from './authentication';
import { cancellableCurlRequest, cancellableRunScript } from './cancellation';
import { filterClientCertificates } from './certificate';
import { runScriptConcurrently, type TransformedExecuteScriptContext } from './concurrency';
import { addSetCookiesToToughCookieJar } from './set-cookie-util';

export const getOrInheritAuthentication = ({ request, requestGroups }: { request: Request | WebSocketRequest; requestGroups: RequestGroup[] }): RequestAuthentication | {} => {
  const hasValidAuth = getAuthObjectOrNull(request.authentication) && isAuthEnabled(request.authentication);
  if (hasValidAuth) {
    return request.authentication;
  }
  const hasParentFolders = requestGroups.length > 0;
  const closestParentFolderWithAuth = requestGroups.find(({ authentication }) => getAuthObjectOrNull(authentication) && isAuthEnabled(authentication));
  const closestAuth = getAuthObjectOrNull(closestParentFolderWithAuth?.authentication);
  const shouldCheckFolderAuth = hasParentFolders && closestAuth;
  if (shouldCheckFolderAuth) {
    // override auth with closest parent folder that has one set
    return closestAuth;
  }
  // if no auth is specified on request or folders, default to none
  return { type: 'none' };
};
export function getOrInheritHeaders({ request, requestGroups }: { request: Pick<BaseRequest, 'headers'>; requestGroups: Pick<RequestGroup, 'headers'>[] }): RequestHeader[] {
  const httpHeaders = new Headers();
  const originalCaseMap = new Map<string, string>();
  // parent folders, then child folders, then request
  const headerContexts = [...requestGroups.reverse(), request];
  const headers = headerContexts.map(({ headers }) => headers || []).flat();
  headers.forEach(({ name, value, disabled }) => {
    if (disabled || !name.trim()) {
      return;
    }
    const normalizedCase = name.toLowerCase();
    // preserves the casing of the last header with the same name
    originalCaseMap.set(normalizedCase, name);
    const isStrictValueHeader = SINGLE_VALUE_HEADERS.includes(normalizedCase);
    if (isStrictValueHeader) {
      httpHeaders.set(normalizedCase, value);
      return;
    }
    // appending will join matching header values with a comma
    httpHeaders.append(normalizedCase, value);
  });
  return Array.from(httpHeaders.entries()).map(([name, value]) => ({ name: originalCaseMap.get(name)!, value }));
}
// (only used for getOAuth2 token) Intended to gather all required database objects and initialize ids
export const fetchRequestGroupData = async (requestGroupId: string) => {
  const requestGroup = await models.requestGroup.getById(requestGroupId);
  invariant(requestGroup, 'failed to find requestGroup ' + requestGroupId);
  const ancestors = await db.withAncestors<RequestGroup | Workspace | MockRoute | MockServer>(requestGroup, [
    models.requestGroup.type,
    models.workspace.type,
    models.mockRoute.type,
    models.mockServer.type,
  ]);
  const workspaceDoc = ancestors.find(isWorkspace);
  invariant(workspaceDoc?._id, 'failed to find workspace');
  const workspaceId = workspaceDoc._id;

  const workspace = await models.workspace.getById(workspaceId);
  invariant(workspace, 'failed to find workspace');
  const workspaceMeta = await models.workspaceMeta.getOrCreateByParentId(workspace._id);
  // NOTE: parent folders wont be checked in here since we only use it for oauth2 requests right now, so they are discarded in that code path
  // fallback to base environment
  const activeEnvironmentId = workspaceMeta.activeEnvironmentId;
  const activeEnvironment = activeEnvironmentId && await models.environment.getById(activeEnvironmentId);
  const environment = activeEnvironment || await models.environment.getOrCreateForParentId(workspace._id);
  invariant(environment, 'failed to find environment ' + activeEnvironmentId);

  const settings = await models.settings.get();
  invariant(settings, 'failed to create settings');
  const clientCertificates = await models.clientCertificate.findByParentId(workspaceId);
  const caCert = await models.caCertificate.findByParentId(workspaceId);
  const responseId = generateId('res');
  const responsesDir = pathJoin((process.type === 'renderer' ? window : require('electron')).app.getPath('userData'), 'responses');
  const timelinePath = pathJoin(responsesDir, responseId + '.timeline');
  return { environment, settings, clientCertificates, caCert, activeEnvironmentId, timelinePath, responseId };
};
// Intended to gather all required database objects and initialize ids
export const fetchRequestData = async (requestId: string) => {
  const request = await models.request.getById(requestId);
  invariant(request, 'failed to find request ' + requestId);
  const ancestors = await db.withAncestors<Request | RequestGroup | Workspace | Project | MockRoute | MockServer>(request, [
    models.request.type,
    models.requestGroup.type,
    models.workspace.type,
    models.project.type,
    models.mockRoute.type,
    models.mockServer.type,
  ]);
  const workspaceDoc = ancestors.find(isWorkspace);
  invariant(workspaceDoc?._id, 'failed to find workspace');
  const workspaceId = workspaceDoc._id;

  const workspace = await models.workspace.getById(workspaceId);
  invariant(workspace, 'failed to find workspace');
  const workspaceMeta = await models.workspaceMeta.getOrCreateByParentId(workspace._id);
  // fallback to base environment
  const activeEnvironmentId = workspaceMeta.activeEnvironmentId;
  const activeEnvironment = activeEnvironmentId && await models.environment.getById(activeEnvironmentId);
  // no active environment in workspaceMeta, fallback to workspace root environment as active environment
  const environment = activeEnvironment || await models.environment.getOrCreateForParentId(workspace._id);
  invariant(environment, 'failed to find environment ' + activeEnvironmentId);

  const baseEnvironment = await models.environment.getOrCreateForParentId(workspaceId);
  const cookieJar = await models.cookieJar.getOrCreateForParentId(workspaceId);

  let activeGlobalEnvironment: Environment | undefined = undefined;
  if (workspaceMeta?.activeGlobalEnvironmentId) {
    activeGlobalEnvironment = await models.environment.getById(workspaceMeta.activeGlobalEnvironmentId) || undefined;
  }

  const settings = await models.settings.get();
  invariant(settings, 'failed to create settings');
  const clientCertificates = await models.clientCertificate.findByParentId(workspaceId);
  const caCert = await models.caCertificate.findByParentId(workspaceId);
  const responseId = generateId('res');
  const responsesDir = pathJoin((process.type === 'renderer' ? window : require('electron')).app.getPath('userData'), 'responses');
  const timelinePath = pathJoin(responsesDir, responseId + '.timeline');

  return {
    request,
    environment,
    baseEnvironment,
    cookieJar,
    activeGlobalEnvironment,
    settings,
    clientCertificates,
    caCert,
    activeEnvironmentId: activeEnvironmentId || environment._id,
    timelinePath,
    responseId,
    ancestors,
  };
};

export const tryToExecutePreRequestScript = async (
  {
    request,
    environment,
    baseEnvironment,
    activeGlobalEnvironment,
    cookieJar,
    settings,
    clientCertificates,
    timelinePath,
    responseId,
    ancestors,
  }: Awaited<ReturnType<typeof fetchRequestData>>,
  transientVariables: Environment,
  userUploadEnvironment?: UserUploadEnvironment,
  iteration?: number,
  iterationCount?: number,
  runtime?: SendActionRuntime,
) => {
  const requestGroups = ancestors.filter(doc => isRequest(doc) || isRequestGroup(doc)) as RequestGroup[];
  const folderScripts = requestGroups.reverse()
    .filter(group => group?.preRequestScript)
    .map((group, i) => `const fn${i} = async ()=>{
        ${group.preRequestScript}
      }
      await fn${i}();
  `);
  const originalRequestGroups = requestGroups
    .filter(group => isRequestGroup(group));
  const parentFolders = originalRequestGroups
    .map(group => ({ id: group._id, name: group.name, environment: group.environment }));

  if (folderScripts.length === 0) {
    return {
      request,
      environment,
      baseEnvironment,
      clientCertificates,
      settings,
      cookieJar,
      globals: activeGlobalEnvironment,
      userUploadEnvironment,
      requestTestResults: new Array<RequestTestResult>(),
      transientVariables,
      logs: '',
      parentFolders,
    };
  }
  const joinedScript = [...folderScripts].join('\n');

  const mutatedContext = await tryToExecuteScript({
    script: joinedScript,
    request,
    environment,
    timelinePath,
    responseId,
    baseEnvironment,
    clientCertificates,
    cookieJar,
    globals: activeGlobalEnvironment,
    userUploadEnvironment,
    iteration,
    iterationCount,
    ancestors,
    eventName: 'prerequest',
    settings,
    transientVariables,
    runtime,
    parentFolders,
  });
  if (!mutatedContext || 'error' in mutatedContext) {
    return {
      error: `Execute pre-request script failed: ${mutatedContext?.error}`,
      request,
      environment,
      baseEnvironment,
      clientCertificates,
      settings,
      cookieJar,
      globals: activeGlobalEnvironment,
      requestTestResults: new Array<RequestTestResult>(),
      parentFolders,
    };
  }
  await savePatchesMadeByScript(mutatedContext, environment, baseEnvironment, activeGlobalEnvironment, originalRequestGroups);

  return {
    request: mutatedContext.request,
    environment: mutatedContext.environment,
    baseEnvironment: mutatedContext.baseEnvironment || baseEnvironment,
    clientCertificates: mutatedContext.clientCertificates || clientCertificates,
    settings: mutatedContext.settings || settings,
    globals: mutatedContext.globals,
    cookieJar: mutatedContext.cookieJar,
    requestTestResults: mutatedContext.requestTestResults,
    userUploadEnvironment: mutatedContext.userUploadEnvironment,
    execution: mutatedContext.execution,
    transientVariables: mutatedContext.transientVariables,
    parentFolders: mutatedContext.parentFolders,
  };
};

// savePatchesMadeByScript persists entities
// The rule for the global environment:
//  - If no global environment is seleted, no operation
//  - If one global environment is selected, it persists content to the selected global environment (base or sub).
export async function savePatchesMadeByScript(
  mutatedContext: TransformedExecuteScriptContext,
  environment: Environment,
  baseEnvironment: Environment,
  activeGlobalEnvironment: Environment | undefined,
  originalRequestGroups: RequestGroup[],
  responseCookies?: Cookie[],
) {
  if (!mutatedContext) {
    return;
  }

  // persist updated cookieJar if needed
  if (mutatedContext.cookieJar) {
    // merge cookies from response to the cookiejar, or cookies from response will not be persisted
    await models.cookieJar.update(
      mutatedContext.cookieJar,
      { cookies: [...(responseCookies || []), ...mutatedContext.cookieJar.cookies] },
    );
  }
  // when base environment is activated, `mutatedContext.environment` points to it
  const isActiveEnvironmentBase = mutatedContext.environment?._id === baseEnvironment._id;
  const hasEnvironmentAndIsNotBase = mutatedContext.environment && !isActiveEnvironmentBase;
  const updateEnvironment = async (originEnvironment: Environment, mutatedContextEnvironment: Environment) => {
    const { environmentType } = originEnvironment;
    const { data, dataPropertyOrder } = mutatedContextEnvironment;
    await models.environment.update(
      originEnvironment,
      {
        data, dataPropertyOrder,
        // also update kvPairData when environment type is table view(kv pair)
        ...(environmentType === EnvironmentType.KVPAIR && {
          kvPairData: getKVPairFromData(data, dataPropertyOrder),
        }),
      },
    );
  };

  if (hasEnvironmentAndIsNotBase) {
    await updateEnvironment(environment, mutatedContext.environment);
  }
  if (mutatedContext.baseEnvironment) {
    await updateEnvironment(baseEnvironment, mutatedContext.baseEnvironment);
  }

  if (activeGlobalEnvironment && mutatedContext) {
    invariant(mutatedContext.globals, 'globals must be defined when there is selected one');
    await updateEnvironment(activeGlobalEnvironment, mutatedContext.globals);
  }

  mutatedContext.parentFolders.forEach(mutatedFolder => {
    const originalFolder = originalRequestGroups.find(originalFolder => originalFolder._id === mutatedFolder.id);
    if (originalFolder) {
      models.requestGroup.update(originalFolder, {
        environment: mutatedFolder.environment,
        // also update kvPairData when folder environment type is table view(kv pair)
        ...(originalFolder.environmentType === EnvironmentType.KVPAIR && {
          kvPairData: getKVPairFromData(mutatedFolder.environment, originalFolder.environmentPropertyOrder),
        }),
      });
    }
  });
}

export const tryToExecuteScript = async (context: RequestAndContextAndOptionalResponse) => {
  const {
    script,
    request,
    environment,
    timelinePath,
    responseId,
    baseEnvironment,
    clientCertificates,
    cookieJar,
    response,
    globals,
    userUploadEnvironment,
    iteration,
    iterationCount,
    ancestors,
    eventName,
    execution,
    transientVariables,
    runtime,
    parentFolders,
  } = context;
  invariant(script, 'script must be provided');

  const settings = await models.settings.get();
  // location is the complete path of a request, including project, collection and folder(if have).
  const requestLocation = ancestors
    .filter(doc => isRequest(doc) || isRequestGroup(doc) || isWorkspace(doc) || isProject(doc))
    .reverse()
    .map(doc => doc.name);

  try {
    const fn = process.type === 'renderer' ? runScriptConcurrently : cancellableRunScript;
    const originalOutput = await fn({
      script,
      context: {
        request,
        timelinePath,
        timeout: settings.timeout,
        // if the selected environment points to the base environment
        // script operations on the environment will be applied on the base environment
        environment: {
          id: environment._id,
          name: environment.name,
          data: environment.data || {},
        },
        baseEnvironment: {
          id: baseEnvironment._id,
          name: baseEnvironment.name,
          data: baseEnvironment.data || {},
        },
        clientCertificates,
        settings,
        cookieJar,
        requestInfo: {
          eventName: eventName === 'prerequest' ? 'prerequest' : 'test',
          iterationCount,
          iteration,
        },
        response,
        globals: globals?.data || undefined,
        iterationData: userUploadEnvironment ? {
          name: userUploadEnvironment.name,
          data: userUploadEnvironment.data || {},
        } : undefined,
        execution: {
          ...execution, // keep some existing properties in the after-response script from the pre-request script
          location: requestLocation,
        },
        transientVariables,
        logs: [],
        parentFolders,
      },
    });
    if ('error' in originalOutput) {
      return { error: `Script executor returns error: ${originalOutput.error}` };
    }
    const output = originalOutput as RequestContext;

    const envPropertyOrder = orderedJSON.parse(
      JSON.stringify(output.environment.data),
      JSON_ORDER_PREFIX,
      JSON_ORDER_SEPARATOR,
    );
    environment.data = output.environment.data;
    environment.dataPropertyOrder = envPropertyOrder.map;

    const baseEnvPropertyOrder = orderedJSON.parse(
      JSON.stringify(output.baseEnvironment.data),
      JSON_ORDER_PREFIX,
      JSON_ORDER_SEPARATOR,
    );
    baseEnvironment.data = output.baseEnvironment.data;
    baseEnvironment.dataPropertyOrder = baseEnvPropertyOrder.map;

    if (globals) {
      const globalEnvPropertyOrder = orderedJSON.parse(
        JSON.stringify(output.globals || {}),
        JSON_ORDER_PREFIX,
        JSON_ORDER_SEPARATOR,
      );
      globals.data = output.globals || {};
      globals.dataPropertyOrder = globalEnvPropertyOrder.map;
    }

    if (userUploadEnvironment) {
      const userUploadEnvPropertyOrder = orderedJSON.parse(
        JSON.stringify(output?.iterationData?.data || []),
        JSON_ORDER_PREFIX,
        JSON_ORDER_SEPARATOR,
      );
      userUploadEnvironment.data = output?.iterationData?.data || [];
      userUploadEnvironment.dataPropertyOrder = userUploadEnvPropertyOrder.map;
    }

    if (runtime) {
      await runtime.appendTimeline(timelinePath, output.logs);
    }

    if (output?.transientVariables !== undefined) {
      const variablesPropertyOrder = orderedJSON.parse(
        JSON.stringify(output?.transientVariables?.data || {}),
        JSON_ORDER_PREFIX,
        JSON_ORDER_SEPARATOR,
      );
      transientVariables.data = output?.transientVariables?.data || {};
      transientVariables.dataPropertyOrder = variablesPropertyOrder.map;
    }

    return {
      request: output.request,
      environment,
      baseEnvironment,
      settings: output.settings,
      clientCertificates: output.clientCertificates,
      cookieJar: output.cookieJar,
      globals,
      userUploadEnvironment,
      requestTestResults: output.requestTestResults,
      execution: output.execution,
      transientVariables,
      parentFolders: output.parentFolders,
    };
  } catch (err) {
    await fs.promises.appendFile(
      timelinePath,
      serializeNDJSON([{ value: err.message, name: 'Text', timestamp: Date.now() }])
    );

    const requestId = request._id;
    const errMessage = err.stack ? `message: ${err.messsage}; stack: ${err.stack}` : err.message;
    const responsePatch = {
      _id: responseId,
      parentId: requestId,
      environemntId: environment._id,
      globalEnvironmentId: globals?._id,
      timelinePath,
      statusMessage: 'Error',
      error: errMessage,
    };
    const res = await models.response.create(responsePatch, settings.maxHistoryResponses);
    models.requestMeta.updateOrCreateByParentId(requestId, { activeResponseId: res._id });
    return { error: errMessage };
  }
};

interface RequestContextForScript {
  request: Request;
  environment: Environment;
  timelinePath: string;
  responseId: string;
  baseEnvironment: Environment;
  clientCertificates: ClientCertificate[];
  cookieJar: CookieJar;
  ancestors: (Request | RequestGroup | Workspace | Project | MockRoute | MockServer)[];
  globals?: Environment; // there could be no global environment
  settings: Settings;
  execution?: ExecutionOption;
  transientVariables: Environment;
  parentFolders: { id: string; name: string; environment: Record<string, any> }[];
}

type RequestAndContextAndResponse = RequestContextForScript & {
  response: sendCurlAndWriteTimelineError | sendCurlAndWriteTimelineResponse;
  iteration?: number;
  iterationCount?: number;
  runtime: SendActionRuntime;
};

type RequestAndContextAndOptionalResponse = RequestContextForScript & {
  script: string;
  response?: sendCurlAndWriteTimelineError | sendCurlAndWriteTimelineResponse;
  userUploadEnvironment?: UserUploadEnvironment;
  iteration?: number;
  iterationCount?: number;
  eventName?: RequestContext['requestInfo']['eventName'];
  runtime?: SendActionRuntime;
  parentFolders: { id: string; name: string; environment: Record<string, any> }[];
};

export async function tryToExecuteAfterResponseScript(context: RequestAndContextAndResponse) {
  const requestGroups = context.ancestors.filter(doc => isRequest(doc) || isRequestGroup(doc)) as RequestGroup[];
  const folderScripts = requestGroups.reverse()
    .filter(group => group?.afterResponseScript)
    .map((group, i) => `const fn${i} = async ()=>{
        ${group.afterResponseScript}
      }
      await fn${i}();
  `);
  const originalRequestGroups = requestGroups
    .filter(group => isRequestGroup(group));

  if (folderScripts.length === 0) {
    return {
      ...context,
      requestTestResults: new Array<RequestTestResult>(),
    };
  }
  const joinedScript = [...folderScripts].join('\n');
  const postMutatedContext = await tryToExecuteScript({ script: joinedScript, ...context, eventName: 'test' });
  if (!postMutatedContext || 'error' in postMutatedContext) {
    return {
      error: `Execute after-response script failed: ${postMutatedContext?.error}`,
      ...context,
    };
  }

  // cookies from response should also be persisted
  const respondedWithoutError = context.response && !('error' in context.response);
  if (respondedWithoutError) {
    const resp = context.response as sendCurlAndWriteTimelineResponse;
    await savePatchesMadeByScript(postMutatedContext, context.environment, context.baseEnvironment, context.globals, originalRequestGroups, resp.cookies);
  } else {
    await savePatchesMadeByScript(postMutatedContext, context.environment, context.baseEnvironment, context.globals, originalRequestGroups);
  }

  return postMutatedContext;
}

export const tryToInterpolateRequest = async ({
  request,
  environment,
  purpose,
  extraInfo,
  baseEnvironment,
  userUploadEnvironment,
  transientVariables,
  ignoreUndefinedEnvVariable,
}: {
  request: Request;
  environment: string | Environment;
  purpose?: RenderPurpose;
  extraInfo?: ExtraRenderInfo;
  baseEnvironment?: Environment;
  userUploadEnvironment?: UserUploadEnvironment;
  transientVariables?: Environment;
  ignoreUndefinedEnvVariable?: boolean;
}
) => {
  try {
    return await getRenderedRequestAndContext({
      request: request,
      environment,
      baseEnvironment,
      userUploadEnvironment,
      transientVariables,
      purpose,
      extraInfo,
      ignoreUndefinedEnvVariable,
    });
  } catch (err) {
    if ('type' in err && err.type === 'render') {
      throw err;
    }
    throw new Error(`Failed to render request: ${request._id}`);
  }
};

export const tryToTransformRequestWithPlugins = async (renderResult: RequestAndContext) => {
  const { request, context } = renderResult;
  try {
    return await _applyRequestPluginHooks(request, context);
  } catch (err) {
    throw new Error(`Failed to transform request with plugins: ${request._id}`);
  }
};

export interface sendCurlAndWriteTimelineError {
  _id: string;
  parentId: string;
  timelinePath: string;
  statusMessage: string;
  // additional
  url: string;
  error: string;
  elapsedTime: number;
  bytesRead: number;
}

export interface sendCurlAndWriteTimelineResponse extends ResponsePatch {
  _id: string;
  parentId: string;
  timelinePath: string;
  statusMessage: string;
  cookies: Cookie[];
  timeline: string[];
  bytesRead?: number;
}

export async function sendCurlAndWriteTimeline(
  renderedRequest: RenderedRequest,
  clientCertificates: ClientCertificate[],
  caCert: CaCertificate | null,
  settings: Settings,
  timelinePath: string,
  responseId: string,
  runtime: SendActionRuntime = defaultSendActionRuntime,
): Promise<sendCurlAndWriteTimelineError | sendCurlAndWriteTimelineResponse> {
  const requestId = renderedRequest._id;
  const timeline: ResponseTimelineEntry[] = [];
  const authentication = renderedRequest.authentication as RequestAuthentication;

  const { finalUrl, socketPath } = transformUrl(renderedRequest.url, renderedRequest.parameters, authentication, renderedRequest.settingEncodeUrl);
  timeline.push({ value: `Preparing request to ${finalUrl}`, name: 'Text', timestamp: Date.now() });
  timeline.push({ value: `Current time is ${new Date().toISOString()}`, name: 'Text', timestamp: Date.now() });
  timeline.push({ value: `${renderedRequest.settingEncodeUrl ? 'Enable' : 'Disable'} automatic URL encoding`, name: 'Text', timestamp: Date.now() });

  if (!renderedRequest.settingSendCookies) {
    timeline.push({ value: 'Disable cookie sending due to user setting', name: 'Text', timestamp: Date.now() });
  }
  const authHeader = await getAuthHeader(renderedRequest, finalUrl);
  const requestOptions = {
    requestId,
    req: renderedRequest,
    finalUrl,
    socketPath,
    settings,
    certificates: filterClientCertificates(clientCertificates, renderedRequest.url, 'https:'),
    caCertficatePath: caCert?.disabled === false ? caCert.path : null,
    authHeader,
  };

  // NOTE: conditionally use ipc bridge, renderer cannot import native modules directly
  const nodejsCurlRequest = process.type === 'renderer'
    ? cancellableCurlRequest
    : (await import('../main/network/libcurl-promise')).curlRequest;
  const output = await nodejsCurlRequest(requestOptions);

  if ('error' in output) {
    if (runtime) {
      await runtime.appendTimeline(timelinePath, serializeNDJSON(timeline).split('\n'));
    }

    return {
      _id: responseId,
      parentId: requestId,
      url: requestOptions.finalUrl,
      error: output.error,
      elapsedTime: 0, // 0 because this path is hit during plugin calls
      bytesRead: 0,
      statusMessage: output.statusMessage,
      timelinePath,
      timeline: serializeNDJSON(timeline).split('\n'),
    };
  }
  const { patch, debugTimeline, headerResults, responseBodyPath } = output;
  // todo: move to main process
  debugTimeline.forEach(entry => timeline.push(entry));
  // transform output
  const { cookies, rejectedCookies, totalSetCookies } = await extractCookies(headerResults, renderedRequest.cookieJar, finalUrl, renderedRequest.settingStoreCookies);
  rejectedCookies.forEach(errorMessage => timeline.push({ value: `Rejected cookie: ${errorMessage}`, name: 'Text', timestamp: Date.now() }));
  if (totalSetCookies) {
    await models.cookieJar.update(renderedRequest.cookieJar, { cookies });
    timeline.push({ value: `Saved ${totalSetCookies} cookies`, name: 'Text', timestamp: Date.now() });
  }
  const lastRedirect = headerResults[headerResults.length - 1];

  if (runtime) {
    await runtime.appendTimeline(timelinePath, serializeNDJSON(timeline).split('\n'));
  }

  return {
    _id: responseId,
    parentId: renderedRequest._id,
    timelinePath,
    bodyPath: responseBodyPath,
    contentType: getContentTypeHeader(lastRedirect.headers)?.value || '',
    headers: lastRedirect.headers,
    httpVersion: lastRedirect.version,
    statusCode: lastRedirect.code,
    statusMessage: lastRedirect.reason,
    cookies,
    timeline: serializeNDJSON(timeline).split('\n'),
    ...patch,
  };
}

export const responseTransform = async (patch: ResponsePatch, environmentId: string | null, renderedRequest: RenderedRequest, context: Record<string, any>) => {
  const response: ResponsePatch = {
    ...patch,
    // important for filter by responses
    environmentId,
    globalEnvironmentId: context?.getGlobalEnvironmentId?.() || null,
    bodyCompression: null,
    settingSendCookies: renderedRequest.settingSendCookies,
    settingStoreCookies: renderedRequest.settingStoreCookies,
  };

  if (response.error) {
    console.log(`[network] Response failed req=${patch.parentId} err=${response.error || 'n/a'}`);
    return response;
  }
  console.log(`[network] Response succeeded req=${patch.parentId} status=${response.statusCode || '?'}`,);
  return await _applyResponsePluginHooks(
    response,
    renderedRequest,
    context,
  );
};
export const transformUrl = (url: string, params: RequestParameter[], authentication: RequestAuthentication, shouldEncode: boolean) => {
  const authQueryParam = getAuthQueryParams(authentication);
  const customUrl = joinUrlAndQueryString(url, buildQueryStringFromParams(authQueryParam ? params.concat([authQueryParam]) : params, true, { strictNullHandling: true }));
  const isUnixSocket = customUrl.match(/https?:\/\/unix:\//);
  if (!isUnixSocket) {
    return { finalUrl: smartEncodeUrl(customUrl, shouldEncode, { strictNullHandling: true }) };
  }
  // URL prep will convert "unix:/path" hostname to "unix/path"
  const match = smartEncodeUrl(customUrl, shouldEncode, { strictNullHandling: true }).match(/(https?:)\/\/unix:?(\/[^:]+):\/(.+)/);
  const protocol = (match && match[1]) || '';
  const socketPath = (match && match[2]) || '';
  const socketUrl = (match && match[3]) || '';
  return { finalUrl: `${protocol}//${socketUrl}`, socketPath };
};

const extractCookies = async (headerResults: HeaderResult[], cookieJar: any, finalUrl: string, settingStoreCookies: boolean) => {
  // add set-cookie headers to file(cookiejar) and database
  if (settingStoreCookies) {
    // supports many set-cookies over many redirects
    const redirects: string[][] = headerResults.map(({ headers }: any) => getSetCookiesFromResponseHeaders(headers));
    const setCookieStrings: string[] = redirects.flat();
    const totalSetCookies = setCookieStrings.length;
    if (totalSetCookies) {
      const currentUrl = getCurrentUrl({ headerResults, finalUrl });
      const { cookies, rejectedCookies } = await addSetCookiesToToughCookieJar({ setCookieStrings, currentUrl, cookieJar });
      const hasCookiesToPersist = totalSetCookies > rejectedCookies.length;
      if (hasCookiesToPersist) {
        return { cookies, rejectedCookies, totalSetCookies };
      }
    }
  }
  return { cookies: [], rejectedCookies: [], totalSetCookies: 0 };
};

export const getSetCookiesFromResponseHeaders = (headers: any[]) => getSetCookieHeaders(headers).map(h => h.value);

export const getCurrentUrl = ({ headerResults, finalUrl }: { headerResults: any; finalUrl: string }): string => {
  if (!headerResults || !headerResults.length) {
    return finalUrl;
  }
  const lastRedirect = headerResults[headerResults.length - 1];
  const location = getLocationHeader(lastRedirect.headers);
  if (!location || !location.value) {
    return finalUrl;
  }
  try {
    return new URL(location.value, finalUrl).toString();
  } catch (error) {
    return finalUrl;
  }
};

async function _applyRequestPluginHooks(
  renderedRequest: RenderedRequest,
  renderedContext: Record<string, any>,
) {
  const newRenderedRequest = clone(renderedRequest);

  for (const { plugin, hook } of await plugins.getRequestHooks()) {
    const context = {
      ...(pluginContexts.app.init(RENDER_PURPOSE_NO_RENDER) as Record<string, any>),
      ...pluginContexts.data.init(renderedContext.getProjectId()),
      ...(pluginContexts.store.init(plugin) as Record<string, any>),
      ...(pluginContexts.request.init(newRenderedRequest, renderedContext) as Record<string, any>),
      ...(pluginContexts.network.init() as Record<string, any>),
    };

    try {
      await hook(context);
    } catch (err) {
      err.plugin = plugin;
      throw err;
    }
  }

  return newRenderedRequest;
}

async function _applyResponsePluginHooks(
  response: ResponsePatch,
  renderedRequest: RenderedRequest,
  renderedContext: Record<string, any>,
): Promise<ResponsePatch> {
  try {
    const newResponse = clone(response);
    const newRequest = clone(renderedRequest);
    for (const { plugin, hook } of await plugins.getResponseHooks()) {
      const context = {
        ...(pluginContexts.app.init(RENDER_PURPOSE_NO_RENDER) as Record<string, any>),
        ...pluginContexts.data.init(renderedContext.getProjectId()),
        ...(pluginContexts.store.init(plugin) as Record<string, any>),
        ...(pluginContexts.response.init(newResponse) as Record<string, any>),
        ...(pluginContexts.request.init(newRequest, renderedContext, true) as Record<string, any>),
        ...(pluginContexts.network.init() as Record<string, any>),
      };

      try {
        await hook(context);
      } catch (err) {
        err.plugin = plugin;
        throw err;
      }
    }

    return newResponse;
  } catch (err) {
    console.log('[plugin] Response hook failed', err, response);
    return {
      url: renderedRequest.url,
      error: `[plugin] Response hook failed plugin=${err.plugin?.name} err=${err.message}`,
      elapsedTime: 0, // 0 because this path is hit during plugin calls
      statusMessage: 'Error',
      settingSendCookies: renderedRequest.settingSendCookies,
      settingStoreCookies: renderedRequest.settingStoreCookies,
    };
  }

}
