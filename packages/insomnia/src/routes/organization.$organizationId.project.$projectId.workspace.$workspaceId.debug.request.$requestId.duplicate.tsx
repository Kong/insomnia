import { useCallback } from 'react';
import { href, redirect, useFetcher } from 'react-router';

import * as models from '~/models';
import * as requestOperations from '~/models/helpers/request-operations';
import { invariant } from '~/utils/invariant';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId.duplicate';

export async function clientAction({ params, request }: Route.ClientActionArgs) {
  const { organizationId, projectId, workspaceId, requestId } = params;
  const { name, parentId } = await request.json();

  const req = await requestOperations.getById(requestId);
  invariant(req, 'Request not found');

  if (parentId) {
    const workspace = await models.workspace.getById(parentId);
    invariant(workspace, 'Workspace is required');
    // TODO: if gRPC, we should also copy the protofile to the destination workspace - INS-267
    // Move to top of sort order
    const newRequest = await requestOperations.duplicate(req, { name, parentId, metaSortKey: -1e9 });
    invariant(newRequest, 'Failed to duplicate request');

    models.stats.incrementCreatedRequests();

    return null;
  }

  const newRequest = await requestOperations.duplicate(req, { name });
  invariant(newRequest, 'Failed to duplicate request');

  models.stats.incrementCreatedRequests();

  return redirect(
    href('/organization/:organizationId/project/:projectId/workspace/:workspaceId/debug/request/:requestId', {
      organizationId,
      projectId,
      workspaceId,
      requestId: newRequest._id,
    }),
  );
}

export function useRequestDuplicateActionFetcher(args?: Parameters<typeof useFetcher>[0]) {
  const { submit: fetcherSubmit, ...fetcherRest } = useFetcher<typeof clientAction>(args);

  const submit = useCallback(
    ({
      organizationId,
      projectId,
      workspaceId,
      requestId,
      name,
      parentId,
    }: {
      organizationId: string;
      projectId: string;
      workspaceId: string;
      requestId: string;
      name: string;
      parentId?: string;
    }) => {
      const url = href(
        '/organization/:organizationId/project/:projectId/workspace/:workspaceId/debug/request/:requestId/duplicate',
        {
          organizationId,
          projectId,
          workspaceId,
          requestId,
        },
      );

      return fetcherSubmit(JSON.stringify({ name, parentId }), {
        action: url,
        method: 'POST',
        encType: 'application/json',
      });
    },
    [fetcherSubmit],
  );

  return {
    ...fetcherRest,
    submit,
  };
}
