import clone from 'clone';
import type * as Har from 'har-format';
import { Cookie as ToughCookie } from 'tough-cookie';

import type { BaseModel } from '../models';
import * as models from '../models';
import { isRequest, type Request } from '../models/request';
import type { RequestGroup } from '../models/request-group';
import type { Response } from '../models/response';
import { isWorkspace, type Workspace } from '../models/workspace';
import { getAuthHeader } from '../network/authentication';
import * as plugins from '../plugins';
import * as pluginApp from '../plugins/context/app';
import * as pluginRequest from '../plugins/context/request';
import * as pluginStore from '../plugins/context/store';
import { RenderError } from '../templating/render-error';
import type { RenderedRequest } from '../templating/types';
import { parseGraphQLReqeustBody } from '../utils/graph-ql';
import { smartEncodeUrl } from '../utils/url/querystring';
import { getAppVersion } from './constants';
import { jarFromCookies } from './cookies';
import { database } from './database';
import { filterHeaders, getSetCookieHeaders, hasAuthHeader } from './misc';
import { getRenderedRequestAndContext } from './render';

const getDocWithDescendants =
  (includePrivateDocs = false) =>
  async (parentDoc: BaseModel | null) => {
    const docs = parentDoc ? await database.getWithDescendants(parentDoc) : [];
    return docs.filter(
      // Don't include if private, except if we want to
      doc => !doc?.isPrivate || includePrivateDocs,
    );
  };

export async function exportWorkspacesHAR(workspaces: Workspace[], includePrivateDocs = false) {
  const promises = workspaces.map(getDocWithDescendants(includePrivateDocs));
  const docs = (await Promise.all(promises)).flat();
  const requests = docs.filter(isRequest);
  return exportRequestsHAR(requests, includePrivateDocs);
}

export async function exportRequestsHAR(requests: BaseModel[], includePrivateDocs = false) {
  const workspaces: BaseModel[] = [];
  const mapRequestIdToWorkspace: Record<string, any> = {};
  const workspaceLookup: Record<string, any> = {};

  for (const request of requests) {
    const ancestors: BaseModel[] = await database.withAncestors(request, [
      models.workspace.type,
      models.requestGroup.type,
    ]);
    const workspace = ancestors.find(isWorkspace);
    mapRequestIdToWorkspace[request._id] = workspace;

    if (workspace == null || workspace._id in workspaceLookup) {
      continue;
    }

    workspaceLookup[workspace._id] = true;
    workspaces.push(workspace);
  }

  const mapWorkspaceIdToEnvironmentId: Record<string, any> = {};

  for (const workspace of workspaces) {
    const workspaceMeta = await models.workspaceMeta.getByParentId(workspace._id);
    let environmentId = workspaceMeta ? workspaceMeta.activeEnvironmentId : null;
    const environment = await models.environment.getById(environmentId || 'n/a');

    if (!environment || (environment.isPrivate && !includePrivateDocs)) {
      environmentId = 'n/a';
    }

    mapWorkspaceIdToEnvironmentId[workspace._id] = environmentId;
  }

  requests = requests.sort((a: Record<string, any>, b: Record<string, any>) =>
    a.metaSortKey < b.metaSortKey ? -1 : 1,
  );
  const harRequests: ExportRequest[] = [];

  for (const request of requests) {
    const workspace = mapRequestIdToWorkspace[request._id];

    if (workspace == null) {
      // Workspace not found for request, so don't export it.
      continue;
    }

    const environmentId = mapWorkspaceIdToEnvironmentId[workspace._id];
    harRequests.push({
      requestId: request._id,
      environmentId: environmentId,
    });
  }

  const data = await exportHar(harRequests);
  return JSON.stringify(data, null, '\t');
}
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
    const request = await models.request.getById(exportRequest.requestId);

    if (!request) {
      continue;
    }

    const harRequest = await exportHarWithRequest(request, exportRequest.environmentId || undefined);

    if (!harRequest) {
      continue;
    }

    const response = await (exportRequest.responseId
      ? models.response.getById(exportRequest.responseId)
      : models.response.getLatestForRequestId(exportRequest.requestId, exportRequest.environmentId || null));

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

export async function exportHarResponse(response?: Response) {
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
    content: await getResponseContent(response),
    redirectURL: '',
    headersSize: -1,
    bodySize: -1,
  };
  return harResponse;
}

export async function exportHarRequest(requestId: string, environmentId: string, addContentLength = false) {
  const request = await models.request.getById(requestId);

  if (!request) {
    return null;
  }

  return exportHarWithRequest(request, environmentId, addContentLength);
}

export async function exportHarWithRequest(request: Request, environmentId?: string, addContentLength = false) {
  try {
    const renderResult = await getRenderedRequestAndContext({ request, environment: environmentId });
    const renderedRequest = await _applyRequestPluginHooks(renderResult.request, renderResult.context);
    parseGraphQLReqeustBody(renderedRequest);
    return exportHarWithRenderedRequest(renderedRequest, addContentLength);
  } catch (err) {
    const error =
      err instanceof RenderError
        ? new Error(`Failed to render "${request.name}:${err.path}"\n ${err.message}`)
        : new Error(`Failed to export request "${request.name}"\n ${err.message}`);
    throw error;
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
      ...(pluginApp.init() as Record<string, any>),
      ...(pluginRequest.init(newRenderedRequest, renderedContext) as Record<string, any>),
      ...(pluginStore.init(plugin) as Record<string, any>),
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

export async function exportHarWithRenderedRequest(renderedRequest: RenderedRequest, addContentLength = false) {
  const url = smartEncodeUrl(renderedRequest.url, renderedRequest.settingEncodeUrl);

  if (addContentLength) {
    const hasContentLengthHeader = filterHeaders(renderedRequest.headers, 'Content-Length').length > 0;

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
    postData: await getRequestPostData(renderedRequest),
    headersSize: -1,
    bodySize: -1,
  };
  return harRequest;
}

function getRequestCookies(renderedRequest: RenderedRequest) {
  // filter out invalid cookies to avoid getCookiesSync complaining
  const jar = jarFromCookies(renderedRequest.cookieJar.cookies);
  const domainCookies = renderedRequest.url ? jar.getCookiesSync(renderedRequest.url) : [];
  const harCookies: Har.Cookie[] = domainCookies.map(mapCookie);
  return harCookies;
}

export function getResponseCookiesFromHeaders(headers: Har.Cookie[]) {
  return getSetCookieHeaders(headers).reduce((accumulator, harCookie) => {
    let cookie: null | undefined | ToughCookie = null;

    try {
      cookie = ToughCookie.parse(harCookie.value || '', { loose: true });
    } catch {}

    if (cookie === null || cookie === undefined) {
      return accumulator;
    }

    return [...accumulator, mapCookie(cookie)];
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

    if (expires && !Number.isNaN(expires.getTime())) {
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

async function getResponseContent(response: Response) {
  let body = await models.response.getBodyBuffer(response);

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

async function getRequestPostData(renderedRequest: RenderedRequest): Promise<Har.PostData | undefined> {
  let body;
  if (renderedRequest.body.fileName) {
    try {
      const text = await window.main.secureReadFile({ path: renderedRequest.body.fileName });

      body = {
        text,
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
        ...(type === 'file' ? { fileName } : { value }),
      })),
    };
  }

  return {
    mimeType: body.mimeType || '',
    text: body.text || '',
  };
}
