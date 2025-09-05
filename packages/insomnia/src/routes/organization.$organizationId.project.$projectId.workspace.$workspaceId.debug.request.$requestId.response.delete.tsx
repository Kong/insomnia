import { href } from 'react-router';

import * as models from '~/models';
import * as requestOperations from '~/models/helpers/request-operations';
import { isSocketIORequestId } from '~/models/socket-io-request';
import { isWebSocketRequestId } from '~/models/websocket-request';
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

  if (isWebSocketRequestId(requestId)) {
    const res = await models.webSocketResponse.getById(responseId);
    invariant(res, 'Response not found');
    await models.webSocketResponse.remove(res);
    const response = await models.webSocketResponse.getLatestForRequestId(requestId, workspaceMeta.activeEnvironmentId);
    if (response?.requestVersionId) {
      await models.requestVersion.restore(response.requestVersionId);
    }
    await models.requestMeta.updateOrCreateByParentId(requestId, { activeResponseId: response?._id || null });
  } else if (isSocketIORequestId(requestId)) {
    const res = await models.socketIOResponse.getById(responseId);
    invariant(res, 'Response not found');
    await models.socketIOResponse.remove(res);
    const response = await models.socketIOResponse.getLatestForRequestId(requestId, workspaceMeta.activeEnvironmentId);
    if (response?.requestVersionId) {
      await models.requestVersion.restore(response.requestVersionId);
    }
    await models.requestMeta.updateOrCreateByParentId(requestId, { activeResponseId: response?._id || null });
  } else {
    const res = await models.response.getById(responseId);
    invariant(res, 'Response not found');
    await models.response.remove(res);
    const response = await models.response.getLatestForRequestId(requestId, workspaceMeta.activeEnvironmentId);
    if (response?.requestVersionId) {
      await models.requestVersion.restore(response.requestVersionId);
    }
    await models.requestMeta.updateOrCreateByParentId(requestId, { activeResponseId: response?._id || null });
  }

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
