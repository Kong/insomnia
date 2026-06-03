import type * as Har from 'har-format';
import type { BaseModel, Cookie, Environment, Request, RequestGroup, Response, Workspace } from 'insomnia-data';
import { models, services } from 'insomnia-data';
import { Cookie as ToughCookie } from 'tough-cookie';

import { getAuthHeader } from '~/main/network/get-auth-header';
import { secureReadFile } from '~/main/secure-read-file';
import { applyRequestHooks } from '~/network/network-adapter';

import { getAppVersion } from '../common/constants';
import { database } from '../common/database';
import { filterHeaders, getSetCookieHeaders, hasAuthHeader } from '../common/misc';
import { getRenderedRequestAndContext } from '../common/render';
import { RenderError } from '../templating/render-error';
import type { RenderedRequest } from '../templating/types';
import { parseGraphQLReqeustBody } from '../utils/graph-ql';
import { smartEncodeUrl } from '../utils/url/querystring';

const { isRequest } = models.request;

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
    const workspace = ancestors.find(models.workspace.isWorkspace);
    mapRequestIdToWorkspace[request._id] = workspace;

    if (workspace == null || workspace._id in workspaceLookup) {
      continue;
    }

    workspaceLookup[workspace._id] = true;
    workspaces.push(workspace);
  }

  const mapWorkspaceIdToEnvironmentId: Record<string, any> = {};

  for (const workspace of workspaces) {
    const workspaceMeta = await services.workspaceMeta.getByParentId(workspace._id);
    let environmentId = workspaceMeta ? workspaceMeta.activeEnvironmentId : null;
    const environment = await services.environment.getById(environmentId || 'n/a');

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
  const workspace = ancestors.find(models.workspace.isWorkspace);
  if (workspace === null || workspace === undefined) {
    throw new TypeError('no workspace found for request');
  }

  const workspaceMeta = await services.workspaceMeta.getByParentId(workspace._id);
  let environmentId = workspaceMeta ? workspaceMeta.activeEnvironmentId : null;
  const environment = await services.environment.getById(environmentId || 'n/a');
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
    const request = await services.request.getById(exportRequest.requestId);

    if (!request) {
      continue;
    }

    const harRequest = await exportHarWithRequest(request, exportRequest.environmentId || undefined);

    if (!harRequest) {
      continue;
    }

    const response = await (exportRequest.responseId
      ? services.response.getById(exportRequest.responseId)
      : services.response.getLatestForRequestId(exportRequest.requestId, exportRequest.environmentId || null));

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
    cookies: await getResponseCookies(response),
    headers: getResponseHeaders(response),
    content: await getResponseContent(response),
    redirectURL: '',
    headersSize: -1,
    bodySize: -1,
  };
  return harResponse;
}

export async function exportHarRequest(requestId: string, environmentOrWorkspaceId: string, addContentLength = false) {
  const request = await services.request.getById(requestId);
  let environmentId: string;
  if (models.environment.isEnvironmentId(environmentOrWorkspaceId)) {
    environmentId = environmentOrWorkspaceId;
  } else if (models.workspace.isWorkspaceId(environmentOrWorkspaceId)) {
    const workspaceMeta = await services.workspaceMeta.getOrCreateByParentId(environmentOrWorkspaceId);
    const baseEnvironment = await services.environment.getOrCreateForParentId(environmentOrWorkspaceId);
    const activeEnvironment =
      (await database.findOne<Environment>(models.environment.type, {
        _id: workspaceMeta.activeEnvironmentId,
      })) || baseEnvironment;
    environmentId = activeEnvironment._id;
  } else {
    throw new Error(`Invalid environmentOrWorkspaceId provided to exportHarRequest: ${environmentOrWorkspaceId}`);
  }

  if (!request) {
    return null;
  }

  return exportHarWithRequest(request, environmentId, addContentLength);
}

export async function exportHarWithRequest(request: Request, environmentId?: string, addContentLength = false) {
  try {
    const renderResult = await getRenderedRequestAndContext({ request, environment: environmentId });
    const renderedRequest = await applyRequestHooks(renderResult.request, renderResult.context);
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
    cookies: await getRequestCookies(renderedRequest),
    headers: getRequestHeaders(renderedRequest),
    queryString: getRequestQueryString(renderedRequest),
    postData: await getRequestPostData(renderedRequest),
    headersSize: -1,
    bodySize: -1,
  };
  return harRequest;
}
async function getRequestCookies(renderedRequest: RenderedRequest): Promise<Har.Cookie[]> {
  if (!renderedRequest.url) {
    return [];
  }
  const domainCookies = getCookiesForUrl(renderedRequest.cookieJar.cookies, renderedRequest.url);
  return domainCookies.map(mapCookieToHar);
}

export function getResponseCookiesFromHeaders(headers: Har.Cookie[]): Har.Cookie[] {
  const setCookieHeaders = getSetCookieHeaders(headers);
  const cookies: Har.Cookie[] = [];

  for (const header of setCookieHeaders) {
    const cookie = parseCookie(header.value);
    if (cookie) {
      cookies.push(mapCookieToHar(cookie));
    }
  }

  return cookies;
}

async function getResponseCookies(response: Response): Promise<Har.Cookie[]> {
  const headers = response.headers.filter(Boolean);
  return getResponseCookiesFromHeaders(headers);
}
function mapCookieToHar(cookie: Cookie): Har.Cookie {
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

function getCookiesForUrl(cookies: Cookie[], url: string): Cookie[] {
  try {
    // Simplified cookie filtering - just returns cookies matching the domain
    return cookies.filter(c => {
      if (!c.domain) return true;
      return url.includes(c.domain);
    });
  } catch {
    return [];
  }
}

function parseCookie(cookieString: string): Cookie | null {
  try {
    const parsed = ToughCookie.parse(cookieString, { loose: true });
    return parsed?.toJSON() as Cookie | null;
  } catch {
    return null;
  }
}

async function getResponseContent(response: Response) {
  let body = await services.helpers.getResponseBodyBuffer(response);

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
      const text = await secureReadFile(renderedRequest.body.fileName);

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
