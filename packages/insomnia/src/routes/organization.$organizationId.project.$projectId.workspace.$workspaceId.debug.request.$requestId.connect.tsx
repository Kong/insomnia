import { GRAPHQL_TRANSPORT_WS_PROTOCOL, MessageType } from 'graphql-ws';
import { href } from 'react-router';

import type { ChangeBufferEvent } from '~/common/database';
import { type McpTransportType, models } from '~/insomnia-data';
import type { CookieJar } from '~/models/cookie-jar';
import * as requestOperations from '~/models/helpers/request-operations';
import type { RequestAuthentication, RequestHeader } from '~/models/request';
import { isEventStreamRequest, isGraphqlSubscriptionRequest } from '~/models/request';
import { isRequestMeta } from '~/models/request-meta';
import { isSocketIORequest } from '~/models/socket-io-request';
import { isWebSocketRequestId } from '~/models/websocket-request';
import { getAuthHeader } from '~/network/authentication';
import type { RenderedRequest } from '~/templating/types';
import { invariant } from '~/utils/invariant';
import { createFetcherSubmitHook } from '~/utils/router';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId.connect';

export interface ConnectActionParams {
  url: string;
  headers: RequestHeader[];
  authentication: RequestAuthentication;
  cookieJar: CookieJar;
  suppressUserAgent: boolean;
  transportType?: McpTransportType;
  query?: Record<string, string>;
  env?: Record<string, string>;
}

export async function clientAction({ params, request }: Route.ClientActionArgs) {
  const { requestId, workspaceId } = params;

  const req = await requestOperations.getById(requestId);
  invariant(req, 'Request not found');
  invariant(workspaceId, 'Workspace ID is required');
  const rendered = (await request.json()) as ConnectActionParams;

  if (isWebSocketRequestId(requestId)) {
    window.main.webSocket.open({
      requestId,
      workspaceId,
      url: rendered.url,
      headers: rendered.headers,
      authentication: rendered.authentication,
      cookieJar: rendered.cookieJar,
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
  }
  if (isEventStreamRequest(req)) {
    const renderedRequest = { ...req, ...rendered } as RenderedRequest;
    const authHeader = await getAuthHeader(renderedRequest, rendered.url);
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
  }
  if (isSocketIORequest(req)) {
    window.main.socketIO.open({
      requestId,
      workspaceId,
      url: rendered.url,
      headers: rendered.headers,
      cookieJar: rendered.cookieJar,
      authentication: rendered.authentication,
      query: rendered.query || {},
    });
  }
  if (models.mcpRequest.isMcpRequest(req)) {
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
