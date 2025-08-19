import { useCallback } from 'react';
import { href, useFetcher } from 'react-router';

import * as models from '~/models';
import type { RequestGroup } from '~/models/request-group';
import { invariant } from '~/utils/invariant';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request-group.duplicate';

export async function clientAction({ request }: Route.ClientActionArgs) {
  const patch = (await request.json()) as Partial<RequestGroup>;
  invariant(patch._id, 'Request group id not found');

  const requestGroup = await models.requestGroup.getById(patch._id);
  invariant(requestGroup, 'Request group not found');

  if (patch.parentId) {
    const workspace = await models.workspace.getById(patch.parentId);
    invariant(workspace, 'Workspace is required');
    // TODO: if gRPC, we should also copy the protofile to the destination workspace - INS-267
    // Move to top of sort order
    const newRequestGroup = await models.requestGroup.duplicate(requestGroup, {
      name: patch.name,
      parentId: patch.parentId,
      metaSortKey: -1e9,
    });

    models.stats.incrementCreatedRequestsForDescendents(newRequestGroup);

    return null;
  }

  const newRequestGroup = await models.requestGroup.duplicate(requestGroup, { name: patch.name });

  models.stats.incrementCreatedRequestsForDescendents(newRequestGroup);

  return null;
}

export function useRequestGroupDuplicateActionFetcher(args?: Parameters<typeof useFetcher>[0]) {
  const {
    submit: fetcherSubmit,
    ...fetcherRest
  } = useFetcher<typeof clientAction>(args);

  const submit = useCallback((
    {
      organizationId,
      projectId,
      workspaceId,
      requestGroupData,
    }: {
      organizationId: string;
      projectId: string;
      workspaceId: string;
      requestGroupData: Partial<RequestGroup>;
    }
  ) => {
    const url = href('/organization/:organizationId/project/:projectId/workspace/:workspaceId/debug/request-group/duplicate', {
      organizationId,
      projectId,
      workspaceId,
    });

    return fetcherSubmit(JSON.stringify(requestGroupData), {
      action: url,
      method: 'POST',
      encType: 'application/json',
    });
  }, [fetcherSubmit]);

  return {
    ...fetcherRest,
    submit,
  };
}
