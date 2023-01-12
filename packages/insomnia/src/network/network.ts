import clone from 'clone';
import fs from 'fs';
import mkdirp from 'mkdirp';
import { join as pathJoin } from 'path';
import { v4 as uuidv4 } from 'uuid';

import { cookiesFromJar, jarFromCookies } from '../common/cookies';
import { database as db } from '../common/database';
import { getDataDirectory } from '../common/electron-helpers';
import {
  getContentTypeHeader,
  getLocationHeader,
  getSetCookieHeaders,
} from '../common/misc';
import type { ExtraRenderInfo, RenderedRequest, RenderPurpose, RequestAndContext } from '../common/render';
import {
  getRenderedRequestAndContext,
  RENDER_PURPOSE_NO_RENDER,
  RENDER_PURPOSE_SEND,
} from '../common/render';
import type { HeaderResult, ResponsePatch, ResponseTimelineEntry } from '../main/network/libcurl-promise';
import * as models from '../models';
import { CaCertificate } from '../models/ca-certificate';
import { ClientCertificate } from '../models/client-certificate';
import { Cookie } from '../models/cookie-jar';
import type { Request, RequestAuthentication, RequestParameter } from '../models/request';
import type { Settings } from '../models/settings';
import { isWorkspace } from '../models/workspace';
import * as pluginContexts from '../plugins/context/index';
import * as plugins from '../plugins/index';
import { invariant } from '../utils/invariant';
import { setDefaultProtocol } from '../utils/url/protocol';
import {
  buildQueryStringFromParams,
  joinUrlAndQueryString,
  smartEncodeUrl,
} from '../utils/url/querystring';
import { getAuthHeader, getAuthQueryParams } from './authentication';
import { cancellableCurlRequest } from './cancellation';
import { urlMatchesCertHost } from './url-matches-cert-host';

// used for oauth grant types
// creates a new request with the patch args
// and uses env and settings from workspace
// not cancellable but currently is
// used indirectly by send and getAuthHeader to fetch tokens
// @TODO unpack oauth into regular timeline and remove oauth timeine dialog
export async function sendWithSettings(
  requestId: string,
  requestPatch: Record<string, any>,
) {
  console.log(`[network] Sending with settings req=${requestId}`);
  const { request,
    environment,
    settings,
    clientCertificates,
    caCert } = await fetchRequestData(requestId);

  const newRequest: Request = await models.initModel(models.request.type, requestPatch, {
    _id: request._id + '.other',
    parentId: request._id,
  });

  const renderResult = await tryToInterpolateRequest(newRequest, environment._id);
  const renderedRequest = await tryToTransformRequestWithPlugins(renderResult);

  const response = await sendCurlAndWriteTimeline(
    renderResult.request,
    clientCertificates,
    caCert,
    { ...settings, validateSSL: settings.validateAuthSSL },
  );
  return responseTransform(response, renderedRequest, renderResult.context);
}

// used by test feature, inso, and plugin api
// not all need to be cancellable or to use curl
export async function send(
  requestId: string,
  environmentId?: string,
  extraInfo?: ExtraRenderInfo,
) {
  console.log(`[network] Sending req=${requestId} env=${environmentId || 'null'}`);

  const { request,
    environment,
    settings,
    clientCertificates,
    caCert } = await fetchRequestData(requestId);

  const renderResult = await tryToInterpolateRequest(request, environment._id, RENDER_PURPOSE_SEND, extraInfo);
  const renderedRequest = await tryToTransformRequestWithPlugins(renderResult);
  const response = await sendCurlAndWriteTimeline(
    renderedRequest,
    clientCertificates,
    caCert,
    settings,
  );
  return responseTransform(response, renderedRequest, renderResult.context);
}

const fetchRequestData = async (requestId: string) => {
  const request = await models.request.getById(requestId);
  invariant(request, 'failed to find request');
  const ancestors = await db.withAncestors(request, [
    models.request.type,
    models.requestGroup.type,
    models.workspace.type,
  ]);
  const workspaceDoc = ancestors.find(isWorkspace);
  const workspaceId = workspaceDoc ? workspaceDoc._id : 'n/a';
  const workspace = await models.workspace.getById(workspaceId);
  invariant(workspace, 'failed to find workspace');
  const workspaceMeta = await models.workspaceMeta.getOrCreateByParentId(workspace._id);

  // fallback to base environment
  const environment = workspaceMeta.activeEnvironmentId ?
    await models.environment.getById(workspaceMeta.activeEnvironmentId)
    : await models.environment.getOrCreateForParentId(workspace._id);
  invariant(environment, 'failed to find environment');

  const settings = await models.settings.getOrCreate();
  invariant(settings, 'failed to create settings');
  const clientCertificates = await models.clientCertificate.findByParentId(workspaceId);
  const caCert = await models.caCertificate.findByParentId(workspaceId);

  return { request, environment, settings, clientCertificates, caCert };
};

export const tryToInterpolateRequest = async (request: Request, environmentId: string, purpose?: RenderPurpose, extraInfo?: ExtraRenderInfo) => {
  try {
    return await getRenderedRequestAndContext({
      request: request,
      environmentId,
      purpose,
      extraInfo,
    });
  } catch (err) {
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
) {
  const requestId = renderedRequest._id;
  const timeline: ResponseTimelineEntry[] = [];

  const { finalUrl, socketPath } = transformUrl(renderedRequest.url, renderedRequest.parameters, renderedRequest.authentication, renderedRequest.settingEncodeUrl);

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
    certificates: clientCertificates.filter(c => !c.disabled && urlMatchesCertHost(setDefaultProtocol(c.host, 'https:'), renderedRequest.url)),
    caCertficatePath: caCert?.disabled === false ? caCert.path : null,
    authHeader,
  };

  // NOTE: conditionally use ipc bridge, renderer cannot import native modules directly
  const nodejsCurlRequest = process.type === 'renderer'
    ? cancellableCurlRequest
    : (await import('../main/network/libcurl-promise')).curlRequest;
  const output = await nodejsCurlRequest(requestOptions);

  if ('error' in output) {
    const timelinePath = await storeTimeline(timeline);

    return {
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
  const timelinePath = await storeTimeline([...timeline, ...debugTimeline]);
  // transform output
  const { cookies, rejectedCookies, totalSetCookies } = await extractCookies(headerResults, renderedRequest.cookieJar, finalUrl, renderedRequest.settingStoreCookies);
  rejectedCookies.forEach(errorMessage => timeline.push({ value: `Rejected cookie: ${errorMessage}`, name: 'Text', timestamp: Date.now() }));
  if (totalSetCookies) {
    await models.cookieJar.update(renderedRequest.cookieJar, { cookies });
    timeline.push({ value: `Saved ${totalSetCookies} cookies`, name: 'Text', timestamp: Date.now() });
  }
  const lastRedirect = headerResults[headerResults.length - 1];

  return {
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
export const responseTransform = (patch: ResponsePatch, renderedRequest: RenderedRequest, context: Record<string, any>) => {
  const response = {
    ...patch,
    environmentId: patch.environmentId,
    bodyCompression: null,
    settingSendCookies: renderedRequest.settingSendCookies,
    settingStoreCookies: renderedRequest.settingStoreCookies,
  };

  if (response.error) {
    console.log(`[network] Response failed req=${patch.parentId} err=${response.error || 'n/a'}`);
    return response;
  }
  console.log(`[network] Response succeeded req=${patch.parentId} status=${response.statusCode || '?'}`,);
  return _applyResponsePluginHooks(
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

export const addSetCookiesToToughCookieJar = async ({ setCookieStrings, currentUrl, cookieJar }: any) => {
  const rejectedCookies: string[] = [];
  const jar = jarFromCookies(cookieJar.cookies);
  for (const setCookieStr of setCookieStrings) {
    try {
      jar.setCookieSync(setCookieStr, currentUrl);
    } catch (err) {
      if (err instanceof Error) {
        rejectedCookies.push(err.message);
      }
    }
  }
  const cookies = (await cookiesFromJar(jar)) as Cookie[];
  return { cookies, rejectedCookies };
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
      ...(pluginContexts.network.init(renderedContext.getEnvironmentId()) as Record<string, any>),
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
        ...(pluginContexts.network.init(renderedContext.getEnvironmentId()) as Record<string, any>),
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
    return {
      url: renderedRequest.url,
      error: `[plugin] Response hook failed plugin=${err.plugin.name} err=${err.message}`,
      elapsedTime: 0, // 0 because this path is hit during plugin calls
      statusMessage: 'Error',
      settingSendCookies: renderedRequest.settingSendCookies,
      settingStoreCookies: renderedRequest.settingStoreCookies,
    };
  }

}

export function storeTimeline(timeline: ResponseTimelineEntry[]): Promise<string> {
  const timelineStr = JSON.stringify(timeline, null, '\t');
  const timelineHash = uuidv4();
  const responsesDir = pathJoin(getDataDirectory(), 'responses');
  mkdirp.sync(responsesDir);
  const timelinePath = pathJoin(responsesDir, timelineHash + '.timeline');
  if (process.type === 'renderer') {
    return window.main.writeFile({ path: timelinePath, content: timelineStr });
  }
  return new Promise<string>((resolve, reject) => {
    fs.writeFile(timelinePath, timelineStr, err => {
      if (err != null) {
        return reject(err);
      }
      resolve(timelinePath);
    });
  });
}
