import { href } from 'react-router';

import { services } from '~/insomnia-data';
import * as models from '~/models';
import * as requestOperations from '~/models/helpers/request-operations';
import { removeResponse } from '~/models/helpers/response-operations';
import { invariant } from '~/utils/invariant';
import { createFetcherSubmitHook } from '~/utils/router';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId.response.delete';

export async function clientAction({ request, params }: Route.ClientActionArgs) {
  const { workspaceId, requestId } = params;

  const req = await requestOperations.getById(requestId);
  invariant(req, 'Request not found');

  const { responseId } = await request.json();
  invariant(typeof responseId === 'string', 'Response ID is required');

  const workspaceMeta = await services.workspaceMeta.getByParentId(workspaceId);
  invariant(workspaceMeta, 'Active workspace meta not found');
  const isWebSocketRequest = models.webSocketRequest.isWebSocketRequestId(requestId);
  const isSocketIORequest = models.socketIORequest.isSocketIORequestId(requestId);
  const isMcpRequest = models.mcpRequest.isMcpRequestId(requestId);

  let responseModel;
  if (isWebSocketRequest) {
    responseModel = services.webSocketResponse;
  } else if (isSocketIORequest) {
    responseModel = services.socketIOResponse;
  } else if (isMcpRequest) {
    responseModel = services.mcpResponse;
  } else {
    responseModel = models.response;
  }

  const res = await responseModel.getById(responseId);
  invariant(res, 'Response not found');

  await removeResponse(res);
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
