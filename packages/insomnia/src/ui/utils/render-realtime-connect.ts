import type { CookieJar, Request, RequestAuthentication, RequestGroup, RequestHeader, RequestParameter, SocketIORequest, WebSocketRequest } from 'insomnia-data';
import { models, services } from 'insomnia-data';

import { database as db } from '../../common/database';
import { getOrInheritAuthentication, getOrInheritHeaders } from '../../network/network';
import { tryToInterpolateRequestOrShowRenderErrorModal } from './try-interpolate';

const { applyPathParametersToUrl } = models.request;
const { isRequestGroup, type: requestGroupType } = models.requestGroup;

export interface RenderedRealtimeConnectPayload {
  /** rendered url with path parameters applied */
  url: string;
  headers: RequestHeader[];
  authentication: RequestAuthentication;
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

  const rendered = await tryToInterpolateRequestOrShowRenderErrorModal({
    request,
    environmentId,
    payload: {
      url: request.url,
      headers,
      authentication,
      parameters: request.parameters.filter(p => !p.disabled),
      pathParameters: request.pathParameters,
      workspaceCookieJar,
    },
  });

  if (!rendered) {
    return undefined;
  }

  // getOrInheritHeaders drops disabled headers, so disabled User-Agent headers are only visible on the raw request/folder headers
  const userAgentHeaders = [...requestGroups, request]
    .flatMap(doc => doc.headers || [])
    .filter(h => h.name?.toLowerCase() === 'user-agent');
  const suppressUserAgent =
    Boolean(request.disableUserAgentHeader) || (userAgentHeaders.length > 0 && userAgentHeaders.every(h => h.disabled));

  const url = applyPathParametersToUrl(rendered.url, rendered.pathParameters);

  return {
    url,
    headers: rendered.headers,
    authentication: rendered.authentication,
    parameters: rendered.parameters,
    workspaceCookieJar: rendered.workspaceCookieJar,
    suppressUserAgent,
  };
}
