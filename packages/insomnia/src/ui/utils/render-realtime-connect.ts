import type { CookieJar, Request, RequestAuthentication, RequestBody, RequestGroup, RequestHeader, RequestParameter, SocketIORequest, WebSocketRequest } from 'insomnia-data';
import { models, services } from 'insomnia-data';

import { database as db } from '../../common/database';
import { getOrInheritAuthentication, getOrInheritHeaders, shouldSuppressUserAgent } from '../../network/network';
import { tryToInterpolateRequestOrShowRenderErrorModal } from './try-interpolate';

const { applyPathParametersToUrl } = models.request;
const { isRequestGroup, type: requestGroupType } = models.requestGroup;

export interface RenderedRealtimeConnectPayload {
  /** rendered url with path parameters applied */
  url: string;
  headers: RequestHeader[];
  authentication: RequestAuthentication;
  body?: RequestBody;
  parameters: RequestParameter[];
  workspaceCookieJar: CookieJar;
  suppressUserAgent: boolean;
}

export async function renderRealtimeConnectPayload({
  request,
  environmentId,
  workspaceId,
}: {
  request: WebSocketRequest | SocketIORequest | Request;
  environmentId: string;
  workspaceId: string;
}): Promise<RenderedRealtimeConnectPayload | undefined> {
  const workspaceCookieJar = await services.cookieJar.getOrCreateForParentId(workspaceId);
  const ancestors = await db.withAncestors<Request | WebSocketRequest | SocketIORequest | RequestGroup>(request, [
    requestGroupType,
  ]);
  const requestGroups = ancestors.filter(isRequestGroup);
  const headers = getOrInheritHeaders({ request, requestGroups });
  const authentication = getOrInheritAuthentication({ request, requestGroups });
  const body = 'body' in request ? request.body : undefined;

  // Only manually-authored cookies may contain live template syntax. Server-set cookie values
  // are excluded from rendering here too, mirroring getRenderedRequestAndContext in render.ts,
  // so that a template placed in a cookie by a response is never re-evaluated when connecting.
  const manualCookies = workspaceCookieJar.cookies.filter(cookie => cookie.source === 'manual');
  const nonManualCookies = workspaceCookieJar.cookies.filter(cookie => cookie.source !== 'manual');

  const rendered = await tryToInterpolateRequestOrShowRenderErrorModal({
    request,
    environmentId,
    payload: {
      url: request.url,
      headers,
      authentication,
      body,
      parameters: request.parameters.filter(p => !p.disabled),
      pathParameters: request.pathParameters,
      workspaceCookieJar: { ...workspaceCookieJar, cookies: manualCookies },
    },
  });

  if (!rendered) {
    return undefined;
  }

  const suppressUserAgent = shouldSuppressUserAgent({ request, requestGroups });

  const url = applyPathParametersToUrl(rendered.url, rendered.pathParameters);

  return {
    url,
    headers: rendered.headers,
    authentication: rendered.authentication,
    body: rendered.body,
    parameters: rendered.parameters,
    workspaceCookieJar: {
      ...rendered.workspaceCookieJar,
      cookies: [...rendered.workspaceCookieJar.cookies, ...nonManualCookies],
    },
    suppressUserAgent,
  };
}
