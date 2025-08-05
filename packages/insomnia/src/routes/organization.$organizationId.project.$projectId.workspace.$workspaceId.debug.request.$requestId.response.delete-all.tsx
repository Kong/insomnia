import { useCallback } from 'react';
import { href, useFetcher } from 'react-router';

import * as models from '~/models';
import * as requestOperations from '~/models/helpers/request-operations';
import { isSocketIORequestId } from '~/models/socket-io-request';
import { isWebSocketRequestId } from '~/models/websocket-request';
import { invariant } from '~/utils/invariant';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId.response.delete';

export async function clientAction({ params }: Route.ClientActionArgs) {
  const { workspaceId, requestId } = params;

  const req = await requestOperations.getById(requestId);
  invariant(req, 'Request not found');

  const workspaceMeta = await models.workspaceMeta.getByParentId(workspaceId);
  invariant(workspaceMeta, 'Active workspace meta not found');

  if (isWebSocketRequestId(requestId)) {
    await models.webSocketResponse.removeForRequest(requestId, workspaceMeta.activeEnvironmentId);
  } else if (isSocketIORequestId(requestId)) {
    await models.socketIOResponse.removeForRequest(requestId, workspaceMeta.activeEnvironmentId);
  } else {
    await models.response.removeForRequest(requestId, workspaceMeta.activeEnvironmentId);
  }

  return null;
}

export function useRequestResponseDeleteAllActionFetcher(args?: Parameters<typeof useFetcher>[0]) {
  const { submit: fetcherSubmit, ...fetcherRest } = useFetcher<typeof clientAction>(args);

  const submit = useCallback(
    ({
      organizationId,
      projectId,
      workspaceId,
      requestId,
    }: {
      organizationId: string;
      projectId: string;
      workspaceId: string;
      requestId: string;
    }) => {
      const url = href(
        '/organization/:organizationId/project/:projectId/workspace/:workspaceId/debug/request/:requestId/response/delete-all',
        {
          organizationId,
          projectId,
          workspaceId,
          requestId,
        },
      );

      return fetcherSubmit(
        {},
        {
          action: url,
          method: 'POST',
        },
      );
    },
    [fetcherSubmit],
  );

  return {
    ...fetcherRest,
    submit,
  };
}
