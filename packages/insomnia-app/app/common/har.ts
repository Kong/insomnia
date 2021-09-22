import clone from 'clone';
import fs from 'fs';
import { jarFromCookies } from 'insomnia-cookies';
import { smartEncodeUrl } from 'insomnia-url';
import { Cookie as toughCookie } from 'tough-cookie';

import * as models from '../models';
import type { Cookie } from '../models/cookie-jar';
import type { Request } from '../models/request';
import { newBodyRaw } from '../models/request';
import type { Response } from '../models/response';
import { isWorkspace } from '../models/workspace';
import { getAuthHeader } from '../network/authentication';
import * as plugins from '../plugins';
import * as pluginContexts from '../plugins/context/index';
import { RenderError } from '../templating/index';
import { getAppVersion } from './constants';
import { database } from './database';
import { filterHeaders, getSetCookieHeaders, hasAuthHeader } from './misc';
import type { RenderedRequest } from './render';
import { getRenderedRequestAndContext } from './render';

export interface HarCookie {
  name: string;
  value: string;
  path?: string;
  domain?: string;
  expires?: string;
  httpOnly?: boolean;
  secure?: boolean;
  comment?: string;
}

export interface HarHeader {
  name: string;
  value: string;
  comment?: string;
}

export interface HarQueryString {
  name: string;
  value: string;
  comment?: string;
}

export interface HarPostParam {
  name: string;
  value?: string;
  fileName?: string;
  contentType?: string;
  comment?: string;
}

export interface HarPostData {
  mimeType: string;
  params: HarPostParam[];
  text: string;
  comment?: string;
}

export interface HarRequest {
  method: string;
  url: string;
  httpVersion: string;
  cookies: HarCookie[];
  headers: HarHeader[];
  queryString: HarQueryString[];
  postData?: HarPostData;
  headersSize: number;
  bodySize: number;
  comment?: string;
  settingEncodeUrl: boolean;
}

export interface HarContent {
  size: number;
  compression?: number;
  mimeType: string;
  text?: string;
  encoding?: string;
  comment?: string;
}

export interface HarResponse {
  status: number;
  statusText: string;
  httpVersion: string;
  cookies: HarCookie[];
  headers: HarHeader[];
  content: HarContent;
  redirectURL: string;
  headersSize: number;
  bodySize: number;
  comment?: string;
}

export interface HarRequestCache {
  expires?: string;
  lastAccess: string;
  eTag: string;
  hitCount: number;
  comment?: string;
}

export interface HarCache {
  beforeRequest?: HarRequestCache;
  afterRequest?: HarRequestCache;
  comment?: string;
}

export interface HarEntryTimings {
  blocked?: number;
  dns?: number;
  connect?: number;
  send: number;
  wait: number;
  receive: number;
  ssl?: number;
  comment?: string;
}

export interface HarEntry {
  pageref?: string;
  startedDateTime: string;
  time: number;
  request: HarRequest;
  response: HarResponse;
  cache: HarCache;
  timings: HarEntryTimings;
  serverIPAddress?: string;
  connection?: string;
  comment?: string;
}

export interface HarPageTimings {
  onContentLoad?: number;
  onLoad?: number;
  comment?: string;
}

export interface HarPage {
  startedDateTime: string;
  id: string;
  title: string;
  pageTimings: HarPageTimings;
  comment?: string;
}

export interface HarCreator {
  name: string;
  version: string;
  comment?: string;
}

export interface HarBrowser {
  name: string;
  version: string;
  comment?: string;
}

export interface HarLog {
  version: string;
  creator: HarCreator;
  browser?: HarBrowser;
  pages?: HarPage[];
  entries: HarEntry[];
  comment?: string;
}

export interface Har {
  log: HarLog;
}

export interface ExportRequest {
  requestId: string;
  environmentId: string | null;
  responseId?: string;
}

export async function exportHarCurrentRequest(request: Request, response: Response): Promise<Har> {
  const ancestors = await database.withAncestors(request, [
    models.workspace.type,
    models.requestGroup.type,
  ]);
  const workspace = ancestors.find(isWorkspace);
  if (workspace === null || workspace === undefined) {
    throw new TypeError('no workspace found for request');
  }

  const workspaceMeta = await models.workspaceMeta.getByParentId(workspace._id);
  let environmentId = workspaceMeta ? workspaceMeta.activeEnvironmentId : null;
  const environment = await models.environment.getById(environmentId || 'n/a');
  if (!environment || environment.isPrivate) {
    environmentId = 'n/a';
  }

  return exportHar([
    {
      requestId: request._id,
      environmentId: environmentId,
      responseId: response._id,
    },
  ]);
}

export async function exportHar(exportRequests: ExportRequest[]) {
  // Export HAR entries with the same start time in order to keep their workspace sort order.
  const startedDateTime = new Date().toISOString();
  const entries: HarEntry[] = [];

  for (const exportRequest of exportRequests) {
    const request: Request | null = await models.request.getById(exportRequest.requestId);

    if (!request) {
      continue;
    }

    const harRequest = await exportHarWithRequest(request, exportRequest.environmentId || undefined);

    if (!harRequest) {
      continue;
    }

    let response: Response | null = null;
    if (exportRequest.responseId) {
      response = await models.response.getById(exportRequest.responseId);
    } else {
      response = await models.response.getLatestForRequest(
        exportRequest.requestId,
        exportRequest.environmentId || null,
      );
    }

    const harResponse = await exportHarResponse(response);

    if (!harResponse) {
      continue;
    }

    const entry = {
      startedDateTime: startedDateTime,
      time: response ? response.elapsedTime : 0,
      request: harRequest,
      response: harResponse,
      cache: {},
      timings: {
        blocked: -1,
        dns: -1,
        connect: -1,
        send: 0,
        wait: response ? response.elapsedTime : 0,
        receive: 0,
        ssl: -1,
      },
      comment: request.name,
    };
    entries.push(entry);
  }

  const har: Har = {
    log: {
      version: '1.2',
      creator: {
        name: 'Insomnia REST Client',
        version: `insomnia.desktop.app:v${getAppVersion()}`,
      },
      entries: entries,
    },
  };
  return har;
}

export async function exportHarResponse(response: Response | null) {
  if (!response) {
    return {
      status: 0,
      statusText: '',
      httpVersion: 'HTTP/1.1',
      cookies: [],
      headers: [],
      content: {
        size: 0,
        mimeType: '',
      },
      redirectURL: '',
      headersSize: -1,
      bodySize: -1,
    };
  }

  const harResponse: HarResponse = {
    status: response.statusCode,
    statusText: response.statusMessage,
    httpVersion: 'HTTP/1.1',
    cookies: getResponseCookies(response),
    headers: getResponseHeaders(response),
    content: getResponseContent(response),
    redirectURL: '',
    headersSize: -1,
    bodySize: -1,
  };
  return harResponse;
}

export async function exportHarRequest(
  requestId: string,
  environmentId: string,
  addContentLength = false,
) {
  const request = await models.request.getById(requestId);

  if (!request) {
    return null;
  }

  return exportHarWithRequest(request, environmentId, addContentLength);
}

export async function exportHarWithRequest(
  request: Request,
  environmentId?: string,
  addContentLength = false,
) {
  try {
    const renderResult = await getRenderedRequestAndContext({ request, environmentId });
    const renderedRequest = await _applyRequestPluginHooks(
      renderResult.request,
      renderResult.context,
    );
    return exportHarWithRenderedRequest(renderedRequest, addContentLength);
  } catch (err) {
    if (err instanceof RenderError) {
      throw new Error(`Failed to render "${request.name}:${err.path}"\n ${err.message}`);
    } else {
      throw new Error(`Failed to export request "${request.name}"\n ${err.message}`);
    }
  }
}

async function _applyRequestPluginHooks(
  renderedRequest: RenderedRequest,
  renderedContext: Record<string, any>,
) {
  let newRenderedRequest = renderedRequest;

  for (const { plugin, hook } of await plugins.getRequestHooks()) {
    newRenderedRequest = clone(newRenderedRequest);
    const context = {
      ...(pluginContexts.app.init() as Record<string, any>),
      ...(pluginContexts.request.init(newRenderedRequest, renderedContext) as Record<string, any>),
      ...(pluginContexts.store.init(plugin) as Record<string, any>),
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

export async function exportHarWithRenderedRequest(
  renderedRequest: RenderedRequest,
  addContentLength = false,
) {
  const url = smartEncodeUrl(renderedRequest.url, renderedRequest.settingEncodeUrl);

  if (addContentLength) {
    const hasContentLengthHeader =
      filterHeaders(renderedRequest.headers, 'Content-Length').length > 0;

    if (!hasContentLengthHeader) {
      const name = 'Content-Length';
      const value = Buffer.byteLength((renderedRequest.body || {}).text || '').toString();
      renderedRequest.headers.push({
        name,
        value,
      });
    }
  }

  // Set auth header if we have it
  if (!hasAuthHeader(renderedRequest.headers)) {
    const header = await getAuthHeader(renderedRequest, url);

    if (header) {
      renderedRequest.headers.push({
        name: header.name,
        value: header.value,
      });
    }
  }

  const harRequest: HarRequest = {
    method: renderedRequest.method,
    url,
    httpVersion: 'HTTP/1.1',
    cookies: getRequestCookies(renderedRequest),
    headers: getRequestHeaders(renderedRequest),
    queryString: getRequestQueryString(renderedRequest),
    postData: getRequestPostData(renderedRequest),
    headersSize: -1,
    bodySize: -1,
    settingEncodeUrl: renderedRequest.settingEncodeUrl,
  };
  return harRequest;
}

function getRequestCookies(renderedRequest: RenderedRequest) {
  const jar = jarFromCookies(renderedRequest.cookieJar.cookies);
  const domainCookies = jar.getCookiesSync(renderedRequest.url);
  const harCookies: HarCookie[] = domainCookies.map(mapCookie);
  return harCookies;
}

function getResponseCookies(response: Response) {
  const headers = response.headers.filter(Boolean) as HarCookie[];
  const responseCookies = getSetCookieHeaders(headers)
    .reduce((accumulator, harCookie) => {
      let cookie: null | undefined | toughCookie = null;

      try {
        cookie = toughCookie.parse(harCookie.value || '');
      } catch (error) {}

      if (cookie === null || cookie === undefined) {
        return accumulator;
      }

      return [
        ...accumulator,
        mapCookie(cookie as unknown as Cookie),
      ];
    }, [] as HarCookie[]);
  return responseCookies;
}

function mapCookie(cookie: Cookie) {
  const harCookie: HarCookie = {
    name: cookie.key,
    value: cookie.value,
  };

  if (cookie.path) {
    harCookie.path = cookie.path;
  }

  if (cookie.domain) {
    harCookie.domain = cookie.domain;
  }

  if (cookie.expires) {
    let expires: Date | null = null;

    if (cookie.expires instanceof Date) {
      expires = cookie.expires;
    } else if (typeof cookie.expires === 'string') {
      expires = new Date(cookie.expires);
    } else if (typeof cookie.expires === 'number') {
      expires = new Date();
      expires.setTime(cookie.expires);
    }

    if (expires && !isNaN(expires.getTime())) {
      harCookie.expires = expires.toISOString();
    }
  }

  if (cookie.httpOnly) {
    harCookie.httpOnly = true;
  }

  if (cookie.secure) {
    harCookie.secure = true;
  }

  return harCookie;
}

function getResponseContent(response: Response) {
  let body = models.response.getBodyBuffer(response);

  if (body === null) {
    body = Buffer.alloc(0);
  }

  const harContent: HarContent = {
    size: body.byteLength,
    mimeType: response.contentType,
    text: body.toString('utf8'),
  };
  return harContent;
}

function getResponseHeaders(response: Response) {
  return response.headers
    .filter(header => header.name)
    .map<HarHeader>(header => ({
      name: header.name,
      value: header.value,
    }));
}

function getRequestHeaders(renderedRequest: RenderedRequest) {
  return renderedRequest.headers
    .filter(header => header.name)
    .map<HarHeader>(header => ({
      name: header.name,
      value: header.value,
    }));
}

function getRequestQueryString(renderedRequest: RenderedRequest): HarQueryString[] {
  return renderedRequest.parameters.map<HarQueryString>(parameter => ({
    name: parameter.name,
    value: parameter.value,
  }));
}

function getRequestPostData(renderedRequest: RenderedRequest): HarPostData | undefined {
  let body;

  if (renderedRequest.body.fileName) {
    try {
      body = newBodyRaw(fs.readFileSync(renderedRequest.body.fileName, 'base64'));
    } catch (e) {
      console.warn('[code gen] Failed to read file', e);
      return;
    }
  } else {
    // For every other type, Insomnia uses the same body format as HAR
    body = renderedRequest.body;
  }

  let params = [];

  if (body.params) {
    params = body.params.map(param => {
      if (param.type === 'file') {
        return {
          name: param.name,
          fileName: param.fileName,
        };
      }

      return {
        name: param.name,
        value: param.value,
      };
    });
  }

  return {
    mimeType: body.mimeType || '',
    text: body.text || '',
    params: params,
  };
}
