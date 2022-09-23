import clone from 'clone';
import fs from 'fs';
import { cookiesFromJar, jarFromCookies } from 'insomnia-cookies';
import {
  buildQueryStringFromParams,
  joinUrlAndQueryString,
  setDefaultProtocol,
  smartEncodeUrl,
} from 'insomnia-url';
import mkdirp from 'mkdirp';
import { join as pathJoin } from 'path';
import { v4 as uuidv4 } from 'uuid';

import {
  STATUS_CODE_PLUGIN_ERROR,
} from '../common/constants';
import { database as db } from '../common/database';
import { getDataDirectory } from '../common/electron-helpers';
import {
  delay,
  getContentTypeHeader,
  getLocationHeader,
  getSetCookieHeaders,
} from '../common/misc';
import type { ExtraRenderInfo, RenderedRequest } from '../common/render';
import {
  getRenderedRequestAndContext,
  RENDER_PURPOSE_NO_RENDER,
  RENDER_PURPOSE_SEND,
} from '../common/render';
import type { ResponsePatch, ResponseTimelineEntry } from '../main/network/libcurl-promise';
import * as models from '../models';
import { ClientCertificate } from '../models/client-certificate';
import type { Environment } from '../models/environment';
import type { Request } from '../models/request';
import type { Settings } from '../models/settings';
import { isWorkspace } from '../models/workspace';
import * as pluginContexts from '../plugins/context/index';
import * as plugins from '../plugins/index';
import { getAuthHeader } from './authentication';
import { urlMatchesCertHost } from './url-matches-cert-host';

// Time since user's last keypress to wait before making the request
const MAX_DELAY_TIME = 1000;

const cancelRequestFunctionMap: Record<string, () => void> = {};

let lastUserInteraction = Date.now();

export async function cancelRequestById(requestId: string) {
  const hasCancelFunction = cancelRequestFunctionMap.hasOwnProperty(requestId) && typeof cancelRequestFunctionMap[requestId] === 'function';
  if (hasCancelFunction) {
    return cancelRequestFunctionMap[requestId]();
  }
  console.log(`[network] Failed to cancel req=${requestId} because cancel function not found`);
}

export async function _actuallySend(
  renderedRequest: RenderedRequest,
  clientCertificates: ClientCertificate[],
  settings: Settings,
) {
  return new Promise<ResponsePatch>(async resolve => {
    const timeline: ResponseTimelineEntry[] = [];

    try {
      // Setup the cancellation logic
      cancelRequestFunctionMap[renderedRequest._id] = async () => {
        const timelinePath = await storeTimeline(timeline);
        // Tear Down the cancellation logic
        if (cancelRequestFunctionMap.hasOwnProperty(renderedRequest._id)) {
          delete cancelRequestFunctionMap[renderedRequest._id];
        }
        // NOTE: conditionally use ipc bridge, renderer cannot import native modules directly
        const nodejsCancelCurlRequest = process.type === 'renderer'
          ? window.main.cancelCurlRequest
          :  (await import('../main/network/libcurl-promise')).cancelCurlRequest;

        nodejsCancelCurlRequest(renderedRequest._id);
        return resolve({
          elapsedTime: 0,
          bytesRead: 0,
          url: renderedRequest.url,
          statusMessage: 'Cancelled',
          error: 'Request was cancelled',
          timelinePath,
        });
      };
      // Set the URL, including the query parameters
      const qs = buildQueryStringFromParams(renderedRequest.parameters);
      const url = joinUrlAndQueryString(renderedRequest.url, qs);
      const isUnixSocket = url.match(/https?:\/\/unix:\//);
      let finalUrl, socketPath;
      if (!isUnixSocket) {
        finalUrl = smartEncodeUrl(url, renderedRequest.settingEncodeUrl);
      } else {
        // URL prep will convert "unix:/path" hostname to "unix/path"
        const match = smartEncodeUrl(url, renderedRequest.settingEncodeUrl).match(/(https?:)\/\/unix:?(\/[^:]+):\/(.+)/);
        const protocol = (match && match[1]) || '';
        socketPath = (match && match[2]) || '';
        const socketUrl = (match && match[3]) || '';
        finalUrl = `${protocol}//${socketUrl}`;
      }
      timeline.push({ value: `Preparing request to ${finalUrl}`, name: 'Text', timestamp: Date.now() });
      timeline.push({ value: `Current time is ${new Date().toISOString()}`, name: 'Text', timestamp: Date.now() });
      timeline.push({ value: `${renderedRequest.settingEncodeUrl ? 'Enable' : 'Disable'} automatic URL encoding`, name: 'Text', timestamp: Date.now() });

      if (!renderedRequest.settingSendCookies) {
        timeline.push({ value: 'Disable cookie sending due to user setting', name: 'Text', timestamp: Date.now() });
      }

      const certificates = clientCertificates.filter(c => !c.disabled && urlMatchesCertHost(setDefaultProtocol(c.host, 'https:'), renderedRequest.url));

      const authHeader = await getAuthHeader(renderedRequest, finalUrl);

      // NOTE: conditionally use ipc bridge, renderer cannot import native modules directly
      const nodejsCurlRequest = process.type === 'renderer'
        ? window.main.curlRequest
        : (await import('../main/network/libcurl-promise')).curlRequest;

      const requestOptions = {
        requestId: renderedRequest._id,
        req: renderedRequest,
        finalUrl,
        socketPath,
        settings,
        certificates,
        authHeader,
      };
      const { patch, debugTimeline, headerResults, responseBodyPath } = await nodejsCurlRequest(requestOptions);
      const { cookieJar, settingStoreCookies } = renderedRequest;

      // add set-cookie headers to file(cookiejar) and database
      if (settingStoreCookies) {
        // supports many set-cookies over many redirects
        const redirects: string[][] = headerResults.map(({ headers }: any) => getSetCookiesFromResponseHeaders(headers));
        const setCookieStrings: string[] = redirects.flat();
        const totalSetCookies = setCookieStrings.length;
        if (totalSetCookies) {
          const currentUrl = getCurrentUrl({ headerResults, finalUrl });
          const { cookies, rejectedCookies } = await addSetCookiesToToughCookieJar({ setCookieStrings, currentUrl, cookieJar });
          rejectedCookies.forEach(errorMessage => timeline.push({ value: `Rejected cookie: ${errorMessage}`, name: 'Text', timestamp: Date.now() }));
          const hasCookiesToPersist = totalSetCookies > rejectedCookies.length;
          if (hasCookiesToPersist) {
            await models.cookieJar.update(cookieJar, { cookies });
            timeline.push({ value: `Saved ${totalSetCookies} cookies`, name: 'Text', timestamp: Date.now() });
          }
        }
      }

      const lastRedirect = headerResults[headerResults.length - 1];
      const responsePatch: ResponsePatch = {
        contentType: getContentTypeHeader(lastRedirect.headers)?.value || '',
        headers: lastRedirect.headers,
        httpVersion: lastRedirect.version,
        statusCode: lastRedirect.code,
        statusMessage: lastRedirect.reason,
        ...patch,
      };
      const timelinePath = await storeTimeline([...timeline, ...debugTimeline]);
      // Tear Down the cancellation logic
      if (cancelRequestFunctionMap.hasOwnProperty(renderedRequest._id)) {
        delete cancelRequestFunctionMap[renderedRequest._id];
      }
      return resolve({
        timelinePath,
        bodyPath: responseBodyPath,
        ...responsePatch,
      });
    } catch (err) {
      console.log('[network] Error', err);
      const timelinePath = await storeTimeline(timeline);
      // Tear Down the cancellation logic
      if (cancelRequestFunctionMap.hasOwnProperty(renderedRequest._id)) {
        delete cancelRequestFunctionMap[renderedRequest._id];
      }
      return resolve({
        url: renderedRequest.url,
        error: err.message || 'Something went wrong',
        elapsedTime: 0, // 0 because this path is hit during plugin calls
        statusMessage: 'Error',
        timelinePath,
      });
    }
  });
}

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
  const cookies = await cookiesFromJar(jar);
  return { cookies, rejectedCookies };
};

export async function sendWithSettings(
  requestId: string,
  requestPatch: Record<string, any>,
) {
  console.log(`[network] Sending with settings req=${requestId}`);
  const request = await models.request.getById(requestId);

  if (!request) {
    throw new Error(`Failed to find request: ${requestId}`);
  }
  const settings = await models.settings.getOrCreate();
  const ancestors = await db.withAncestors(request, [
    models.request.type,
    models.requestGroup.type,
    models.workspace.type,
  ]);
  const workspaceDoc = ancestors.find(isWorkspace);
  const workspaceId = workspaceDoc ? workspaceDoc._id : 'n/a';
  const workspace = await models.workspace.getById(workspaceId);

  if (!workspace) {
    throw new Error(`Failed to find workspace for: ${requestId}`);
  }

  const workspaceMeta = await models.workspaceMeta.getOrCreateByParentId(workspace._id);
  const environmentId: string = workspaceMeta.activeEnvironmentId || 'n/a';
  const newRequest: Request = await models.initModel(models.request.type, requestPatch, {
    _id: request._id + '.other',
    parentId: request._id,
  });
  let renderResult: {
    request: RenderedRequest;
    context: Record<string, any>;
  };
  try {
    renderResult = await getRenderedRequestAndContext({ request: newRequest, environmentId });
  } catch (err) {
    throw new Error(`Failed to render request: ${requestId}`);
  }

  const environment: Environment | null = await models.environment.getById(environmentId || 'n/a');
  const responseEnvironmentId = environment ? environment._id : null;

  const clientCertificates = await models.clientCertificate.findByParentId(workspace._id);
  const response = await _actuallySend(
    renderResult.request,
    clientCertificates,
    { ...settings, validateSSL: settings.validateAuthSSL },
  );
  response.parentId = renderResult.request._id;
  response.environmentId = responseEnvironmentId;
  response.bodyCompression = null;
  response.settingSendCookies = renderResult.request.settingSendCookies;
  response.settingStoreCookies = renderResult.request.settingStoreCookies;
  if (response.error) {
    return response;
  }
  return _applyResponsePluginHooks(
    response,
    renderResult.request,
    renderResult.context,
  );
}

export async function send(
  requestId: string,
  environmentId?: string,
  extraInfo?: ExtraRenderInfo,
) {
  console.log(`[network] Sending req=${requestId} env=${environmentId || 'null'}`);
  // HACK: wait for all debounces to finish

  /*
   * TODO: Do this in a more robust way
   * The following block adds a "long" delay to let potential debounces and
   * database updates finish before making the request. This is done by tracking
   * the time of the user's last keypress and making sure the request is sent a
   * significant time after the last press.
   */
  const timeSinceLastInteraction = Date.now() - lastUserInteraction;
  const delayMillis = Math.max(0, MAX_DELAY_TIME - timeSinceLastInteraction);
  if (delayMillis > 0) {
    await delay(delayMillis);
  }

  // Fetch some things

  const request = await models.request.getById(requestId);
  const settings = await models.settings.getOrCreate();
  const ancestors = await db.withAncestors(request, [
    models.request.type,
    models.requestGroup.type,
    models.workspace.type,
  ]);

  if (!request) {
    throw new Error(`Failed to find request to send for ${requestId}`);
  }
  const renderResult = await getRenderedRequestAndContext(
    {
      request,
      environmentId,
      purpose: RENDER_PURPOSE_SEND,
      extraInfo,
    },
  );

  const renderedRequestBeforePlugins = renderResult.request;
  const renderedContextBeforePlugins = renderResult.context;
  const workspaceDoc = ancestors.find(isWorkspace);
  const workspace = await models.workspace.getById(workspaceDoc ? workspaceDoc._id : 'n/a');

  if (!workspace) {
    throw new Error(`Failed to find workspace for request: ${requestId}`);
  }

  const environment: Environment | null = await models.environment.getById(environmentId || 'n/a');
  const responseEnvironmentId = environment ? environment._id : null;

  let renderedRequest: RenderedRequest;

  try {
    renderedRequest = await _applyRequestPluginHooks(
      renderedRequestBeforePlugins,
      renderedContextBeforePlugins,
    );
  } catch (err) {
    return {
      environmentId: responseEnvironmentId,
      error: err.message || 'Something went wrong',
      parentId: renderedRequestBeforePlugins._id,
      settingSendCookies: renderedRequestBeforePlugins.settingSendCookies,
      settingStoreCookies: renderedRequestBeforePlugins.settingStoreCookies,
      statusCode: STATUS_CODE_PLUGIN_ERROR,
      statusMessage: err.plugin ? `Plugin ${err.plugin.name}` : 'Plugin',
      url: renderedRequestBeforePlugins.url,
    } as ResponsePatch;
  }
  const clientCertificates = await models.clientCertificate.findByParentId(workspace._id);
  const response = await _actuallySend(
    renderedRequest,
    clientCertificates,
    settings,
  );
  response.parentId = renderResult.request._id;
  response.environmentId = responseEnvironmentId;
  response.bodyCompression = null;
  response.settingSendCookies = renderedRequest.settingSendCookies;
  response.settingStoreCookies = renderedRequest.settingStoreCookies;

  console.log(
    response.error
      ? `[network] Response failed req=${requestId} err=${response.error || 'n/a'}`
      : `[network] Response succeeded req=${requestId} status=${response.statusCode || '?'}`,
  );
  if (response.error) {
    return response;
  }
  return _applyResponsePluginHooks(
    response,
    renderedRequest,
    renderedContextBeforePlugins,
  );
}

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

if (global.document) {
  document.addEventListener('keydown', (event: KeyboardEvent) => {
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }

    lastUserInteraction = Date.now();
  });
  document.addEventListener('paste', () => {
    lastUserInteraction = Date.now();
  });
}
