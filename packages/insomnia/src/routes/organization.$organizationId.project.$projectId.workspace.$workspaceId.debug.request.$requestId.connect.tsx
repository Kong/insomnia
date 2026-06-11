import { GRAPHQL_TRANSPORT_WS_PROTOCOL, MessageType } from 'graphql-ws';
import type {
  ChangeBufferEvent,
  CookieJar,
  McpTransportType,
  RequestAuthentication,
  RequestHeader,
} from 'insomnia-data';
import { models, services } from 'insomnia-data';
import { href } from 'react-router';

import type { RenderedRequest } from '~/templating/types';
import { AnalyticsEvent } from '~/ui/analytics';
import { invariant } from '~/utils/invariant';
import { createFetcherSubmitHook } from '~/utils/router';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId.connect';

const { isGraphqlSubscriptionRequest, isEventStreamRequest } = models.request;
const { isRequestMeta } = models.requestMeta;

export interface ConnectActionParams {
  url: string;
  headers: RequestHeader[];
  authentication: RequestAuthentication;
  cookieJar: CookieJar;
  suppressUserAgent: boolean;
  transportType?: McpTransportType;
  query?: Record<string, string>;
  path?: string;
  env?: Record<string, string>;
}

export async function clientAction({ params, request }: Route.ClientActionArgs) {
  const { requestId, workspaceId } = params;

  const req = await services.helpers.getRequestById(requestId);
  invariant(req, 'Request not found');
  invariant(workspaceId, 'Workspace ID is required');
  const rendered = (await request.json()) as ConnectActionParams;

  if (models.webSocketRequest.isWebSocketRequestId(requestId)) {
    window.main.webSocket.open({
      requestId,
      workspaceId,
      url: rendered.url,
      headers: rendered.headers,
      authentication: rendered.authentication,
      cookieJar: rendered.cookieJar,
    });
    window.main.trackAnalyticsEvent({
      event: AnalyticsEvent.requestExecuted,
      properties: { request_type: 'WebSocket' },
    });
  }
  if (isGraphqlSubscriptionRequest(req)) {
    window.main.webSocket.open({
      requestId,
      workspaceId,
      // replace url with ws/wss for graphql subscriptions
      url: rendered.url.replace('http', 'ws').replace('https', 'wss'),
      headers: [
        ...rendered.headers,
        // add graphql-transport-ws protocol for graphql subscription
        {
          name: 'sec-websocket-protocol',
          value: GRAPHQL_TRANSPORT_WS_PROTOCOL,
        },
      ],
      isGraphqlSubscriptionRequest: true,
      // graphql-ws protocol needs to send ConnectionInit message first. Refer: https://github.com/enisdenjo/graphql-ws/blob/master/PROTOCOL.md
      initialPayload: JSON.stringify({
        type: MessageType.ConnectionInit,
      }),
      authentication: rendered.authentication,
      cookieJar: rendered.cookieJar,
    });
    window.main.trackAnalyticsEvent({
      event: AnalyticsEvent.requestExecuted,
      properties: { request_type: 'GraphQL' },
    });
  }
  if (isEventStreamRequest(req)) {
    const renderedRequest = { ...req, ...rendered } as RenderedRequest;
    const authHeader = await window.main.getAuthHeader(renderedRequest, rendered.url);
    window.main.curl.open({
      requestId,
      workspaceId,
      url: rendered.url,
      headers: rendered.headers,
      authHeader,
      authentication: rendered.authentication,
      cookieJar: rendered.cookieJar,
      suppressUserAgent: rendered.suppressUserAgent,
    });
    window.main.trackAnalyticsEvent({
      event: AnalyticsEvent.requestExecuted,
      properties: { request_type: 'Event Stream' },
    });
  }
  if (models.socketIORequest.isSocketIORequest(req)) {
    window.main.socketIO.open({
      requestId,
      workspaceId,
      url: rendered.url,
      headers: rendered.headers,
      cookieJar: rendered.cookieJar,
      authentication: rendered.authentication,
      query: rendered.query || {},
      path: rendered.path,
    });
    window.main.trackAnalyticsEvent({
      event: AnalyticsEvent.requestExecuted,
      properties: { request_type: 'SocketIO' },
    });
  }
  if (models.mcpRequest.isMcpRequest(req)) {
    window.main.trackAnalyticsEvent({
      event: AnalyticsEvent.requestExecuted,
      properties: { request_type: 'MCP' },
    });
    return window.main.mcp.connect({
      requestId,
      workspaceId,
      transportType: rendered.transportType || models.mcpRequest.TRANSPORT_TYPES.HTTP,
      url: rendered.url,
      headers: rendered.headers,
      authentication: rendered.authentication,
      env: rendered.env || {},
    });
  }
  // HACK: even more elaborate hack to get the request to update
  return new Promise(resolve => {
    const unsubscribe = window.main.on('db.changes', async (_, changes: ChangeBufferEvent[]) => {
      for (const change of changes) {
        const [event, doc] = change;
        if (isRequestMeta(doc) && doc.parentId === requestId && event === 'update') {
          resolve(null);
          unsubscribe();
          return;
        }
      }
    });
  });
}

export const useRequestConnectActionFetcher = createFetcherSubmitHook(
  submit =>
    ({
      organizationId,
      projectId,
      workspaceId,
      requestId,
      connectParams,
    }: {
      organizationId: string;
      projectId: string;
      workspaceId: string;
      requestId: string;
      connectParams: ConnectActionParams;
    }) => {
      const url = href(
        '/organization/:organizationId/project/:projectId/workspace/:workspaceId/debug/request/:requestId/connect',
        {
          organizationId,
          projectId,
          workspaceId,
          requestId,
        },
      );

      return submit(JSON.stringify(connectParams), {
        action: url,
        method: 'POST',
        encType: 'application/json',
      });
    },
  clientAction,
);
