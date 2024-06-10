import clone from 'clone';
import fs from 'fs';
import orderedJSON from 'json-order';
import { join as pathJoin } from 'path';

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
import type { HeaderResult, ResponsePatch } from '../main/network/libcurl-promise';
import * as models from '../models';
import { CaCertificate } from '../models/ca-certificate';
import { ClientCertificate } from '../models/client-certificate';
import { CookieJar } from '../models/cookie-jar';
import { Environment } from '../models/environment';
import { MockRoute } from '../models/mock-route';
import { MockServer } from '../models/mock-server';
import type { Request, RequestAuthentication, RequestHeader, RequestParameter } from '../models/request';
import { isRequestGroup, RequestGroup } from '../models/request-group';
import type { Settings } from '../models/settings';
import { WebSocketRequest } from '../models/websocket-request';
import { isWorkspace, Workspace } from '../models/workspace';
import * as pluginContexts from '../plugins/context/index';
import * as plugins from '../plugins/index';
import { invariant } from '../utils/invariant';
import {
  buildQueryStringFromParams,
  joinUrlAndQueryString,
  smartEncodeUrl,
} from '../utils/url/querystring';
import { getAuthHeader, getAuthObjectOrNull, getAuthQueryParams, isAuthEnabled } from './authentication';
import { cancellableCurlRequest, cancellableRunScript } from './cancellation';
import { filterClientCertificates } from './certificate';
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
export function getOrInheritHeaders({ request, requestGroups }: { request: Request; requestGroups: RequestGroup[] }): RequestHeader[] {
  // recurse over each parent folder to append headers
  // in case of duplicate, node-libcurl joins on comma
  const headers = requestGroups
    .reverse()
    .map(({ headers }) => headers || [])
    .flat();
  // if parent has foo: bar and child has foo: baz, request will have foo: bar, baz
  return [...headers, ...request.headers];
}

export const fetchRequestData = async (requestId: string) => {
  const request = await models.request.getById(requestId);
  invariant(request, 'failed to find request');
  const ancestors = await db.withAncestors<Request | RequestGroup | Workspace | MockRoute | MockServer>(request, [
    models.request.type,
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
  // check for authentication overrides in parent folders
  const requestGroups = ancestors.filter(isRequestGroup) as RequestGroup[];
  request.authentication = getOrInheritAuthentication({ request, requestGroups });
  request.headers = getOrInheritHeaders({ request, requestGroups });
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
  return { request, environment, settings, clientCertificates, caCert, activeEnvironmentId, timelinePath, responseId };
};
export const getPreRequestScriptOutput = async ({
  request,
  environment,
  settings,
  clientCertificates,
  timelinePath,
  responseId,
}: Awaited<ReturnType<typeof fetchRequestData>>, workspaceId: string) => {
  const baseEnvironment = await models.environment.getOrCreateForParentId(workspaceId);
  const cookieJar = await models.cookieJar.getOrCreateForParentId(workspaceId);

  if (!request.preRequestScript) {
    return {
      request,
      environment,
      baseEnvironment,
      clientCertificates,
      settings,
    };
  }
  const mutatedContext = await tryToExecutePreRequestScript({
    request,
    environment,
    timelinePath,
    responseId,
    baseEnvironment,
    clientCertificates,
    cookieJar,
  });
  if (!mutatedContext?.request) {
    // exiy early if there was a problem with the pre-request script
    // TODO: improve error message?
    return null;
  }

  await savePatchesMadeByScript(mutatedContext, environment, baseEnvironment);
  return {
    request: mutatedContext.request,
    environment: mutatedContext.environment,
    baseEnvironment: mutatedContext.baseEnvironment || baseEnvironment,
    clientCertificates: mutatedContext.clientCertificates || clientCertificates,
    settings: mutatedContext.settings || settings,
  };
};

export async function savePatchesMadeByScript(
  mutatedContext: Awaited<ReturnType<typeof tryToExecutePreRequestScript>>,
  environment: Environment,
  baseEnvironment: Environment,
) {
  if (!mutatedContext) {
    return;
  }

  // persist updated cookieJar if needed
  if (mutatedContext.cookieJar) {
    await models.cookieJar.update(
      mutatedContext.cookieJar,
      { cookies: mutatedContext.cookieJar.cookies },
    );
  }
  // when base environment is activated, `mutatedContext.environment` points to it
  const isActiveEnvironmentBase = mutatedContext.environment?._id === baseEnvironment._id;
  const hasEnvironmentAndIsNotBase = mutatedContext.environment && !isActiveEnvironmentBase;
  if (hasEnvironmentAndIsNotBase) {
    await models.environment.update(
      environment,
      {
        data: mutatedContext.environment.data,
        dataPropertyOrder: mutatedContext.environment.dataPropertyOrder,
      }
    );
  }
  if (mutatedContext.baseEnvironment) {
    await models.environment.update(
      baseEnvironment,
      {
        data: mutatedContext.baseEnvironment.data,
        dataPropertyOrder: mutatedContext.baseEnvironment.dataPropertyOrder,
      }
    );
  }
}
export const tryToExecuteScript = async (context: RequestAndContextAndOptionalResponse) => {
  const { script, request, environment, timelinePath, responseId, baseEnvironment, clientCertificates, cookieJar, response } = context;
  invariant(script, 'script must be provided');

  const settings = await models.settings.get();

  try {
    const timeout = settings.timeout || 5000;
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error('Timeout: Hidden browser window is not responding'));
        // Add one extra second to ensure the hidden browser window has had a chance to return its timeout
        // TODO: restart the hidden browser window
      }, timeout + 2000);
    });
  // const isBaseEnvironmentSelected = environment._id === baseEnvironment._id;
    // if (isBaseEnvironmentSelected) {
    //   // postman models base env as no env and does not persist, so we could handle that case better, but for now we throw
    //   throw new Error('Base environment cannot be selected for script execution. Please select an environment.');
    // }
    const executionPromise = cancellableRunScript({
      script,
      context: {
        request,
        timelinePath,
        timeout: settings.timeout,
        // it inputs empty environment data when active environment is the base environment
        // this is more deterministic and avoids that script accidently manipulates baseEnvironment instead of environment
        environment: environment._id === baseEnvironment._id ? {} : (environment?.data || {}),
        environmentName: environment._id === baseEnvironment._id ? '' : (environment?.name || ''),
        baseEnvironment: baseEnvironment?.data || {},
        baseEnvironmentName: baseEnvironment?.name || '',
        clientCertificates,
        settings,
        cookieJar,
        response,
      },
    });
    const output = await Promise.race([timeoutPromise, executionPromise]) as {
      request: Request;
      environment: Record<string, any>;
      baseEnvironment: Record<string, any>;
      settings: Settings;
      clientCertificates: ClientCertificate[];
      cookieJar: CookieJar;
    };
    console.log('[network] script execution succeeded', output);

    const envPropertyOrder = orderedJSON.parse(
      JSON.stringify(output.environment),
      JSON_ORDER_PREFIX,
      JSON_ORDER_SEPARATOR,
    );
    environment.data = output.environment;
    environment.dataPropertyOrder = envPropertyOrder.map;

    const baseEnvPropertyOrder = orderedJSON.parse(
      JSON.stringify(output.baseEnvironment),
      JSON_ORDER_PREFIX,
      JSON_ORDER_SEPARATOR,
    );
    baseEnvironment.data = output.baseEnvironment;
    baseEnvironment.dataPropertyOrder = baseEnvPropertyOrder.map;

    return {
      request: output.request,
      environment,
      baseEnvironment,
      settings: output.settings,
      clientCertificates: output.clientCertificates,
      cookieJar: output.cookieJar,
    };
  } catch (err) {
    await fs.promises.appendFile(
      timelinePath,
      JSON.stringify({ value: err.message, name: 'Text', timestamp: Date.now() }) + '\n',
    );

    const requestId = request._id;
    const responsePatch = {
      _id: responseId,
      parentId: requestId,
      environemntId: environment._id,
      timelinePath,
      statusMessage: 'Error',
      error: err.message,
    };
    const res = await models.response.create(responsePatch, settings.maxHistoryResponses);
    models.requestMeta.updateOrCreateByParentId(requestId, { activeResponseId: res._id });
    return null;
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
}
type RequestAndContextAndResponse = RequestContextForScript & {
  response: sendCurlAndWriteTimelineError | sendCurlAndWriteTimelineResponse;
};
type RequestAndContextAndOptionalResponse = RequestContextForScript & {
  script: string;
  response?: sendCurlAndWriteTimelineError | sendCurlAndWriteTimelineResponse;
};
export async function tryToExecutePreRequestScript(context: RequestContextForScript) {
  const requestGroups = await db.withAncestors<Request | RequestGroup>(context.request, [
    models.requestGroup.type,
  ]) as (Request | RequestGroup)[];

  const folderScripts = requestGroups.reverse()
    .filter(group => group?.preRequestScript)
    .map((group, i) => `const fn${i} = async ()=>{
        ${group.preRequestScript}
      }
      await fn${i}();
  `);
  const joinedScript = [...folderScripts].join('\n');

  return tryToExecuteScript({ script: joinedScript, ...context });
};

export async function tryToExecuteAfterResponseScript(context: RequestAndContextAndResponse) {
  const requestGroups = await db.withAncestors<Request | RequestGroup>(context.request, [
    models.requestGroup.type,
  ]) as (Request | RequestGroup)[];

  const folderScripts = requestGroups.reverse()
    .filter(group => group?.afterResponseScript)
    .map((group, i) => `const fn${i} = async ()=>{
        ${group.afterResponseScript}
      }
      await fn${i}();
  `);
  const joinedScript = [...folderScripts].join('\n');

  return tryToExecuteScript({ script: joinedScript, ...context });
}

export const tryToInterpolateRequest = async (
  request: Request,
  environment: string | Environment,
  purpose?: RenderPurpose,
  extraInfo?: ExtraRenderInfo,
  baseEnvironment?: Environment,
  ignoreUndefinedEnvVariable?: boolean,
) => {
  try {
    return await getRenderedRequestAndContext({
      request: request,
      environment,
      baseEnvironment,
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
}

export async function sendCurlAndWriteTimeline(
  renderedRequest: RenderedRequest,
  clientCertificates: ClientCertificate[],
  caCert: CaCertificate | null,
  settings: Settings,
  timelinePath: string,
  responseId: string,
): Promise<sendCurlAndWriteTimelineError | sendCurlAndWriteTimelineResponse> {
  const requestId = renderedRequest._id;
  const timelineStrings: string[] = [];
  const authentication = renderedRequest.authentication as RequestAuthentication;

  const { finalUrl, socketPath } = transformUrl(renderedRequest.url, renderedRequest.parameters, authentication, renderedRequest.settingEncodeUrl);
  timelineStrings.push(JSON.stringify({ value: `Preparing request to ${finalUrl}`, name: 'Text', timestamp: Date.now() }) + '\n');
  timelineStrings.push(JSON.stringify({ value: `Current time is ${new Date().toISOString()}`, name: 'Text', timestamp: Date.now() }) + '\n');
  timelineStrings.push(JSON.stringify({ value: `${renderedRequest.settingEncodeUrl ? 'Enable' : 'Disable'} automatic URL encoding`, name: 'Text', timestamp: Date.now() }) + '\n');

  if (!renderedRequest.settingSendCookies) {
    timelineStrings.push(JSON.stringify({ value: 'Disable cookie sending due to user setting', name: 'Text', timestamp: Date.now() }) + '\n');
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
    await fs.promises.appendFile(timelinePath, timelineStrings.join(''));

    return {
      _id: responseId,
      parentId: requestId,
      url: requestOptions.finalUrl,
      error: output.error,
      elapsedTime: 0, // 0 because this path is hit during plugin calls
      bytesRead: 0,
      statusMessage: output.statusMessage,
      timelinePath,
    };
  }
  const { patch, debugTimeline, headerResults, responseBodyPath } = output;
  // todo: move to main process
  debugTimeline.forEach(entry => timelineStrings.push(JSON.stringify(entry) + '\n'));
  // transform output
  const { cookies, rejectedCookies, totalSetCookies } = await extractCookies(headerResults, renderedRequest.cookieJar, finalUrl, renderedRequest.settingStoreCookies);
  rejectedCookies.forEach(errorMessage => timelineStrings.push(JSON.stringify({ value: `Rejected cookie: ${errorMessage}`, name: 'Text', timestamp: Date.now() }) + '\n'));
  if (totalSetCookies) {
    await models.cookieJar.update(renderedRequest.cookieJar, { cookies });
    timelineStrings.push(JSON.stringify({ value: `Saved ${totalSetCookies} cookies`, name: 'Text', timestamp: Date.now() }) + '\n');
  }
  const lastRedirect = headerResults[headerResults.length - 1];

  await fs.promises.appendFile(timelinePath, timelineStrings.join(''));

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
    ...patch,
  };
}

export const responseTransform = async (patch: ResponsePatch, environmentId: string | null, renderedRequest: RenderedRequest, context: Record<string, any>) => {
  const response: ResponsePatch = {
    ...patch,
    // important for filter by responses
    environmentId,
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
  const customUrl = joinUrlAndQueryString(url, buildQueryStringFromParams(authQueryParam ? params.concat([authQueryParam]) : params));
  const isUnixSocket = customUrl.match(/https?:\/\/unix:\//);
  if (!isUnixSocket) {
    return { finalUrl: smartEncodeUrl(customUrl, shouldEncode) };
  }
  // URL prep will convert "unix:/path" hostname to "unix/path"
  const match = smartEncodeUrl(customUrl, shouldEncode).match(/(https?:)\/\/unix:?(\/[^:]+):\/(.+)/);
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
