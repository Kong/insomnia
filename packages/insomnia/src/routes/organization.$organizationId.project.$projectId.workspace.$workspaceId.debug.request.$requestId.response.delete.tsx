import { href } from 'react-router';

import * as models from '~/models';
import * as requestOperations from '~/models/helpers/request-operations';
import { isMcpRequestId } from '~/models/mcp-request';
import type { McpResponse } from '~/models/mcp-response';
import type { Response } from '~/models/response';
import { isSocketIORequestId } from '~/models/socket-io-request';
import type { SocketIOResponse } from '~/models/socket-io-response';
import { isWebSocketRequestId } from '~/models/websocket-request';
import type { WebSocketResponse } from '~/models/websocket-response';
import { invariant } from '~/utils/invariant';
import { createFetcherSubmitHook } from '~/utils/router';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId.response.delete';

export async function clientAction({ request, params }: Route.ClientActionArgs) {
  const { workspaceId, requestId } = params;

  const req = await requestOperations.getById(requestId);
  invariant(req, 'Request not found');

  const { responseId } = await request.json();
  invariant(typeof responseId === 'string', 'Response ID is required');

  const workspaceMeta = await models.workspaceMeta.getByParentId(workspaceId);
  invariant(workspaceMeta, 'Active workspace meta not found');
  const isWebSocketRequest = isWebSocketRequestId(requestId);
  const isSocketIORequest = isSocketIORequestId(requestId);
  const isMcpRequest = isMcpRequestId(requestId);

  let responseModel;
  if (isWebSocketRequest) {
    responseModel = models.webSocketResponse;
  } else if (isSocketIORequest) {
    responseModel = models.socketIOResponse;
  } else if (isMcpRequest) {
    responseModel = models.mcpResponse;
  } else {
    responseModel = models.response;
  }

  const res = await responseModel.getById(responseId);
  invariant(res, 'Response not found');

  // Type-safe remove operation based on the request type
  if (isWebSocketRequest) {
    await models.webSocketResponse.remove(res as WebSocketResponse);
  } else if (isSocketIORequest) {
    await models.socketIOResponse.remove(res as SocketIOResponse);
  } else if (isMcpRequest) {
    await models.mcpResponse.remove(res as McpResponse);
  } else {
    await models.response.remove(res as Response);
  }
  const response = await responseModel.getLatestForRequestId(requestId, workspaceMeta.activeEnvironmentId);
  if (response?.requestVersionId) {
    await models.requestVersion.restore(response.requestVersionId);
  }
  await models.requestMeta.updateOrCreateByParentId(requestId, {
    activeResponseId: response?._id || null,
  });

  return null;
}

export const useRequestResponseDeleteActionFetcher = createFetcherSubmitHook(
  submit =>
    ({
      organizationId,
      projectId,
      workspaceId,
      requestId,
      responseId,
    }: {
      organizationId: string;
      projectId: string;
      workspaceId: string;
      requestId: string;
      responseId: string;
    }) => {
      const url = href(
        '/organization/:organizationId/project/:projectId/workspace/:workspaceId/debug/request/:requestId/response/delete',
        {
          organizationId,
          projectId,
          workspaceId,
          requestId,
        },
      );

      return submit(JSON.stringify({ responseId }), {
        action: url,
        method: 'POST',
        encType: 'application/json',
      });
    },
  clientAction,
);
