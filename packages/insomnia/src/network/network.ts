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
import type { Request, RequestAuthentication, RequestParameter } from '../models/request';
import type { Settings } from '../models/settings';
import { isWorkspace } from '../models/workspace';
import * as pluginContexts from '../plugins/context/index';
import * as plugins from '../plugins/index';
import { invariant } from '../utils/invariant';
import {
  buildQueryStringFromParams,
  joinUrlAndQueryString,
  smartEncodeUrl,
} from '../utils/url/querystring';
import { getAuthHeader, getAuthQueryParams } from './authentication';
import { cancellableCurlRequest, cancellableRunPreRequestScript } from './cancellation';
import { filterClientCertificates } from './certificate';
import { addSetCookiesToToughCookieJar } from './set-cookie-util';

export const fetchRequestData = async (requestId: string) => {
  const request = await models.request.getById(requestId);
  invariant(request, 'failed to find request');
  const ancestors = await db.withAncestors(request, [
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

export const tryToExecutePreRequestScript = async (
  request: Request,
  environment: Environment,
  timelinePath: string,
  responseId: string,
  baseEnvironment: Environment,
  clientCertificates: ClientCertificate[],
  cookieJar: CookieJar,
) => {
  if (!request.preRequestScript) {
    return {
      request,
      environment: undefined,
      baseEnvironment: undefined,
    };
  }
  const settings = await models.settings.get();

  try {
    const timeout = settings.timeout || 5000;
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error('Timeout: Hidden browser window is not responding'));
        // Add one extra second to ensure the hidden browser window has had a chance to return its timeout
        // TODO: restart the hidden browser window
      }, timeout + 1000);
    });
    const preRequestPromise = cancellableRunPreRequestScript({
      script: request.preRequestScript,
      context: {
        request,
        timelinePath,
        timeout: settings.timeout,
        // it inputs empty environment data when active environment is the base environment
        // this is more deterministic and avoids that script accidently manipulates baseEnvironment instead of environment
        environment: environment._id === baseEnvironment._id ? {} : (environment?.data || {}),
        baseEnvironment: baseEnvironment?.data || {},
        clientCertificates,
        settings,
        cookieJar,
      },
    });
    const output = await Promise.race([timeoutPromise, preRequestPromise]) as {
      request: Request;
      environment: Record<string, any>;
      baseEnvironment: Record<string, any>;
      settings: Settings;
      clientCertificates: ClientCertificate[];
      cookieJar: CookieJar;
    };
    console.log('[network] Pre-request script succeeded', output);

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
    await fs.promises.appendFile(timelinePath, JSON.stringify({ value: err.message, name: 'Text', timestamp: Date.now() }) + '\n');

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
export async function sendCurlAndWriteTimeline(
  renderedRequest: RenderedRequest,
  clientCertificates: ClientCertificate[],
  caCert: CaCertificate | null,
  settings: Settings,
  timelinePath: string,
  responseId: string,
) {
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
