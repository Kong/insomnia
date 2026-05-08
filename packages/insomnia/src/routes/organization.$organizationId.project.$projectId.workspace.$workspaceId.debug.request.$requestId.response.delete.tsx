import { href } from 'react-router';

import { models, services } from '~/insomnia-data';
import { invariant } from '~/utils/invariant';
import { createFetcherSubmitHook } from '~/utils/router';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId.response.delete';

export async function clientAction({ request, params }: Route.ClientActionArgs) {
  const { workspaceId, requestId } = params;

  const req = await services.helpers.getRequestById(requestId);
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
    responseModel = services.response;
  }

  const res = await responseModel.getById(responseId);
  invariant(res, 'Response not found');

  await services.helpers.removeResponse(res);
  const response = await responseModel.getLatestForRequestId(requestId, workspaceMeta.activeEnvironmentId);
  if (response?.requestVersionId) {
    await services.requestVersion.restore(response.requestVersionId);
  }
  await services.requestMeta.updateOrCreateByParentId(requestId, {
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
