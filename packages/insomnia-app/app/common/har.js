// @flow
import fs from 'fs';
import clone from 'clone';
import { Cookie as toughCookie } from 'tough-cookie';
import * as models from '../models';
import type { RenderedRequest } from './render';
import { getRenderedRequestAndContext } from './render';
import { jarFromCookies } from 'insomnia-cookies';
import * as pluginContexts from '../plugins/context/index';
import * as misc from './misc';
import type { Cookie } from '../models/cookie-jar';
import type { Request } from '../models/request';
import { newBodyRaw } from '../models/request';
import type { Response as ResponseModel } from '../models/response';
import { getAuthHeader } from '../network/authentication';
import { getAppVersion } from './constants';
import { RenderError } from '../templating/index';
import { smartEncodeUrl } from 'insomnia-url';
import * as plugins from '../plugins';

export type HarCookie = {
  name: string,
  value: string,
  path?: string,
  domain?: string,
  expires?: string,
  httpOnly?: boolean,
  secure?: boolean,
  comment?: string
};

export type HarHeader = {
  name: string,
  value: string,
  comment?: string
};

export type HarQueryString = {
  name: string,
  value: string,
  comment?: string
};

export type HarPostParam = {
  name: string,
  value?: string,
  fileName?: string,
  contentType?: string,
  comment?: string
};

export type HarPostData = {
  mimeType: string,
  params: Array<HarPostParam>,
  text: string,
  comment?: string
};

export type HarRequest = {
  method: string,
  url: string,
  httpVersion: string,
  cookies: Array<HarCookie>,
  headers: Array<HarHeader>,
  queryString: Array<HarQueryString>,
  postData?: HarPostData,
  headersSize: number,
  bodySize: number,
  comment?: string,
  settingEncodeUrl: boolean
};

export type HarContent = {
  size: number,
  compression?: number,
  mimeType: string,
  text?: string,
  encoding?: string,
  comment?: string
};

export type HarResponse = {
  status: number,
  statusText: string,
  httpVersion: string,
  cookies: Array<HarCookie>,
  headers: Array<HarHeader>,
  content: HarContent,
  redirectURL: string,
  headersSize: number,
  bodySize: number,
  comment?: string
};

export type HarRequestCache = {
  expires?: string,
  lastAccess: string,
  eTag: string,
  hitCount: number,
  comment?: string
};

export type HarCache = {
  beforeRequest?: HarRequestCache,
  afterRequest?: HarRequestCache,
  comment?: string
};

export type HarEntryTimings = {
  blocked?: number,
  dns?: number,
  connect?: number,
  send: number,
  wait: number,
  receive: number,
  ssl?: number,
  comment?: string
};

export type HarEntry = {
  pageref?: string,
  startedDateTime: string,
  time: number,
  request: HarRequest,
  response: HarResponse,
  cache: HarCache,
  timings: HarEntryTimings,
  serverIPAddress?: string,
  connection?: string,
  comment?: string
};

export type HarPageTimings = {
  onContentLoad?: number,
  onLoad?: number,
  comment?: string
};

export type HarPage = {
  startedDateTime: string,
  id: string,
  title: string,
  pageTimings: HarPageTimings,
  comment?: string
};

export type HarCreator = {
  name: string,
  version: string,
  comment?: string
};

export type HarBrowser = {
  name: string,
  version: string,
  comment?: string
};

export type HarLog = {
  version: string,
  creator: HarCreator,
  browser?: HarBrowser,
  pages?: Array<HarPage>,
  entries: Array<HarEntry>,
  comment?: string
};

export type Har = {
  log: HarLog
};

export type ExportRequest = {
  requestId: string,
  environmentId: string
};

export async function exportHar(
  exportRequests: Array<ExportRequest>
): Promise<Har> {
  // Export HAR entries with the same start time in order to keep their workspace sort order.
  const startedDateTime = new Date().toISOString();
  const entries: Array<HarEntry> = [];
  for (let exportRequest of exportRequests) {
    const request: Request | null = await models.request.getById(
      exportRequest.requestId
    );
    if (!request) {
      continue;
    }

    const harRequest = await exportHarWithRequest(
      request,
      exportRequest.environmentId
    );
    if (!harRequest) {
      continue;
    }

    const response: ResponseModel | null = await models.response.getLatestForRequest(
      exportRequest.requestId
    );
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
        ssl: -1
      },
      comment: request.name
    };

    entries.push(entry);
  }

  return {
    log: {
      version: '1.2',
      creator: {
        name: 'Insomnia REST Client',
        version: `insomnia.desktop.app:v${getAppVersion()}`
      },
      entries: entries
    }
  };
}

export async function exportHarResponse(
  response: ResponseModel | null
): Promise<HarResponse> {
  if (!response) {
    return {
      status: 0,
      statusText: '',
      httpVersion: 'HTTP/1.1',
      cookies: [],
      headers: [],
      content: {
        size: 0,
        mimeType: ''
      },
      redirectURL: '',
      headersSize: -1,
      bodySize: -1
    };
  }

  return {
    status: response.statusCode,
    statusText: response.statusMessage,
    httpVersion: 'HTTP/1.1',
    cookies: getReponseCookies(response),
    headers: getResponseHeaders(response),
    content: getResponseContent(response),
    redirectURL: '',
    headersSize: -1,
    bodySize: -1
  };
}

export async function exportHarRequest(
  requestId: string,
  environmentId: string,
  addContentLength: boolean = false
): Promise<HarRequest | null> {
  const request = await models.request.getById(requestId);
  if (!request) {
    return null;
  }

  return exportHarWithRequest(request, environmentId, addContentLength);
}

export async function exportHarWithRequest(
  request: Request,
  environmentId: string,
  addContentLength: boolean = false
): Promise<HarRequest | null> {
  try {
    const renderResult = await getRenderedRequestAndContext(
      request,
      environmentId
    );
    const renderedRequest = await _applyRequestPluginHooks(
      renderResult.request,
      renderResult.context
    );
    return exportHarWithRenderedRequest(renderedRequest, addContentLength);
  } catch (err) {
    if (err instanceof RenderError) {
      throw new Error(
        `Failed to render "${request.name}:${err.path}"\n ${err.message}`
      );
    } else {
      throw new Error(
        `Failed to export request "${request.name}"\n ${err.message}`
      );
    }
  }
}

async function _applyRequestPluginHooks(
  renderedRequest: RenderedRequest,
  renderedContext: Object
): Promise<RenderedRequest> {
  let newRenderedRequest = renderedRequest;
  for (const { plugin, hook } of await plugins.getRequestHooks()) {
    newRenderedRequest = clone(newRenderedRequest);

    const context = {
      ...pluginContexts.app.init(),
      ...pluginContexts.request.init(newRenderedRequest, renderedContext),
      ...pluginContexts.store.init(plugin)
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
  addContentLength: boolean = false
): Promise<HarRequest> {
  const url = smartEncodeUrl(
    renderedRequest.url,
    renderedRequest.settingEncodeUrl
  );

  if (addContentLength) {
    const hasContentLengthHeader =
      misc.filterHeaders(renderedRequest.headers, 'Content-Length').length > 0;

    if (!hasContentLengthHeader) {
      const name = 'Content-Length';
      const value = Buffer.byteLength(
        (renderedRequest.body || {}).text || ''
      ).toString();
      renderedRequest.headers.push({ name, value });
    }
  }

  // Set auth header if we have it
  if (!misc.hasAuthHeader(renderedRequest.headers)) {
    const header = await getAuthHeader(
      renderedRequest._id,
      url,
      renderedRequest.method,
      renderedRequest.authentication
    );
    if (header) {
      renderedRequest.headers.push({
        name: header.name,
        value: header.value
      });
    }
  }

  return {
    method: renderedRequest.method,
    url,
    httpVersion: 'HTTP/1.1',
    cookies: getRequestCookies(renderedRequest),
    headers: getRequestHeaders(renderedRequest),
    queryString: getRequestQueryString(renderedRequest),
    postData: getRequestPostData(renderedRequest),
    headersSize: -1,
    bodySize: -1,
    settingEncodeUrl: renderedRequest.settingEncodeUrl
  };
}

function getRequestCookies(renderedRequest: RenderedRequest): Array<HarCookie> {
  const jar = jarFromCookies(renderedRequest.cookieJar.cookies);
  const domainCookies = jar.getCookiesSync(renderedRequest.url);
  return domainCookies.map(mapCookie);
}

function getReponseCookies(response: ResponseModel): Array<HarCookie> {
  return misc
    .getSetCookieHeaders(response.headers)
    .map(h => {
      let cookie;
      try {
        cookie = toughCookie.parse(h.value || '');
      } catch (error) {}
      if (!cookie) {
        return null;
      }

      return mapCookie(cookie);
    })
    .filter(Boolean);
}

function mapCookie(cookie: Cookie): HarCookie {
  const harCookie: HarCookie = {
    name: cookie.key,
    value: cookie.value
  };

  if (cookie.path) {
    harCookie.path = cookie.path;
  }

  if (cookie.domain) {
    harCookie.domain = cookie.domain;
  }

  if (cookie.expires) {
    let expires = null;
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

function getResponseContent(response: ResponseModel): HarContent {
  let body: Buffer | null = models.response.getBodyBuffer(response);

  if (body === null) {
    body = Buffer.alloc(0);
  }

  return {
    size: body.byteLength,
    mimeType: response.contentType,
    text: body.toString('utf8')
  };
}

function getResponseHeaders(response: ResponseModel): Array<HarHeader> {
  return response.headers.filter(header => header.name).map(h => {
    return {
      name: h.name,
      value: h.value
    };
  });
}

function getRequestHeaders(renderedRequest: RenderedRequest): Array<HarHeader> {
  return renderedRequest.headers.filter(header => header.name).map(header => {
    return {
      name: header.name,
      value: header.value
    };
  });
}

function getRequestQueryString(
  renderedRequest: RenderedRequest
): Array<HarQueryString> {
  return renderedRequest.parameters.map(parameter => {
    return {
      name: parameter.name,
      value: parameter.value
    };
  });
}

function getRequestPostData(
  renderedRequest: RenderedRequest
): HarPostData | void {
  let body;
  if (renderedRequest.body.fileName) {
    try {
      body = newBodyRaw(
        fs.readFileSync(renderedRequest.body.fileName, 'base64')
      );
    } catch (e) {
      console.warn('[code gen] Failed to read file', e);
      return undefined;
    }
  } else {
    // For every other type, Insomnia uses the same body format as HAR
    body = renderedRequest.body;
  }

  let params = [];
  if (body.params) {
    params = body.params.map(param => {
      return {
        name: param.name,
        value: param.value
      };
    });
  }

  return {
    mimeType: body.mimeType || '',
    text: body.text || '',
    params: params
  };
}
