import clone from 'clone';
import fs from 'fs';
import type * as Har from 'har-format';
import { Cookie as ToughCookie } from 'tough-cookie';

import * as models from '../models';
import type { Request } from '../models/request';
import type { RequestGroup } from '../models/request-group';
import type { Response } from '../models/response';
import { isWorkspace, type Workspace } from '../models/workspace';
import { getAuthHeader } from '../network/authentication';
import * as plugins from '../plugins';
import * as pluginContexts from '../plugins/context/index';
import { RenderError } from '../templating/index';
import { parseGraphQLReqeustBody } from '../utils/graph-ql';
import { smartEncodeUrl } from '../utils/url/querystring';
import { getAppVersion } from './constants';
import { jarFromCookies } from './cookies';
import { database } from './database';
import { filterHeaders, getSetCookieHeaders, hasAuthHeader } from './misc';
import type { RenderedRequest } from './render';
import { getRenderedRequestAndContext } from './render';

export interface ExportRequest {
  requestId: string;
  environmentId: string | null;
  responseId?: string;
}

export async function exportHarCurrentRequest(request: Request, response: Response): Promise<Har.Har> {
  const ancestors = await database.withAncestors<Request | RequestGroup | Workspace>(request, [
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
  const entries: Har.Entry[] = [];

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

  const har: Har.Har = {
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

  const harResponse: Har.Response = {
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
    const renderResult = await getRenderedRequestAndContext({ request, environment: environmentId });
    const renderedRequest = await _applyRequestPluginHooks(
      renderResult.request,
      renderResult.context,
    );
    parseGraphQLReqeustBody(renderedRequest);
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
): Promise<RenderedRequest> {
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

  const harRequest: Har.Request = {
    method: renderedRequest.method,
    url,
    httpVersion: 'HTTP/1.1',
    cookies: getRequestCookies(renderedRequest),
    headers: getRequestHeaders(renderedRequest),
    queryString: getRequestQueryString(renderedRequest),
    postData: getRequestPostData(renderedRequest),
    headersSize: -1,
    bodySize: -1,
  };
  return harRequest;
}

function getRequestCookies(renderedRequest: RenderedRequest) {
  // filter out invalid cookies to avoid getCookiesSync complaining
  const sanitized = renderedRequest.cookieJar.cookies.map(cookie => {
    if (!cookie.expires) {
      // TODO: null will make getCookiesSync unhappy
      // probably it should be `undefined` when types of tough cookie is updated
      cookie.expires = 'Infinity';
    }
    return cookie;
  });

  const jar = jarFromCookies(sanitized);
  const domainCookies = renderedRequest.url ? jar.getCookiesSync(renderedRequest.url) : [];
  const harCookies: Har.Cookie[] = domainCookies.map(mapCookie);
  return harCookies;
}

export function getResponseCookiesFromHeaders(headers: Har.Cookie[]) {
  return getSetCookieHeaders(headers)
    .reduce((accumulator, harCookie) => {
      let cookie: null | undefined | ToughCookie = null;

      try {
        cookie = ToughCookie.parse(harCookie.value || '', { loose: true });
      } catch (error) { }

      if (cookie === null || cookie === undefined) {
        return accumulator;
      }

      return [
        ...accumulator,
        mapCookie(cookie),
      ];
    }, [] as Har.Cookie[]);
}

function getResponseCookies(response: Response) {
  const headers = response.headers.filter(Boolean);
  return getResponseCookiesFromHeaders(headers);
}

function mapCookie(cookie: ToughCookie) {
  const harCookie: Har.Cookie = {
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
  const harContent: Har.Content = {
    size: Buffer.byteLength(body),
    mimeType: response.contentType,
    text: body.toString('utf8'),
  };
  return harContent;
}

function getResponseHeaders(response: Response) {
  return response.headers
    .filter(header => header.name)
    .map<Har.Header>(header => ({
      name: header.name,
      value: header.value,
    }));
}

function getRequestHeaders(renderedRequest: RenderedRequest) {
  return renderedRequest.headers
    .filter(header => header.name)
    .map<Har.Header>(header => ({
      name: header.name,
      value: header.value,
    }));
}

function getRequestQueryString(renderedRequest: RenderedRequest): Har.QueryString[] {
  return renderedRequest.parameters.map<Har.QueryString>(parameter => ({
    name: parameter.name,
    value: parameter.value,
  }));
}

function getRequestPostData(renderedRequest: RenderedRequest): Har.PostData | undefined {
  let body;
  if (renderedRequest.body.fileName) {
    try {
      body = {
        text: fs.readFileSync(renderedRequest.body.fileName, 'base64'),
      };
    } catch (error) {
      console.warn('[code gen] Failed to read file', error);
      return;
    }
  } else {
    // For every other type, Insomnia uses the same body format as HAR
    body = renderedRequest.body;
  }

  if (body.params) {
    return {
      mimeType: body.mimeType || '',
      params: body.params.map(({ name, value, fileName, type }) => ({
        name,
        ...(type === 'file'
          ? { fileName }
          : { value }),
      })),
    };
  }

  return {
    mimeType: body.mimeType || '',
    text: body.text || '',
  };
}
