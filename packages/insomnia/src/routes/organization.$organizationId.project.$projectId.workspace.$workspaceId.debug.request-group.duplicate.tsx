import { href } from 'react-router';

import type { RequestGroup } from '~/insomnia-data';
import { services } from '~/insomnia-data';
import { invariant } from '~/utils/invariant';
import { createFetcherSubmitHook } from '~/utils/router';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request-group.duplicate';

export async function clientAction({ request }: Route.ClientActionArgs) {
  const patch = (await request.json()) as Partial<RequestGroup>;
  invariant(patch._id, 'Request group id not found');

  const requestGroup = await services.requestGroup.getById(patch._id);
  invariant(requestGroup, 'Request group not found');

  if (patch.parentId) {
    const workspace = await services.workspace.getById(patch.parentId);
    invariant(workspace, 'Workspace is required');
    // TODO: if gRPC, we should also copy the protofile to the destination workspace - INS-267
    // Move to top of sort order
    const newRequestGroup = await services.requestGroup.duplicate(requestGroup, {
      name: patch.name,
      parentId: patch.parentId,
      metaSortKey: -1e9,
    });

    services.stats.incrementCreatedRequestsForDescendents(newRequestGroup);

    return null;
  }

  const newRequestGroup = await services.requestGroup.duplicate(requestGroup, { name: patch.name });

  services.stats.incrementCreatedRequestsForDescendents(newRequestGroup);

  return null;
}

export const useRequestGroupDuplicateActionFetcher = createFetcherSubmitHook(
  submit =>
    ({
      organizationId,
      projectId,
      workspaceId,
      requestGroupData,
    }: {
      organizationId: string;
      projectId: string;
      workspaceId: string;
      requestGroupData: Partial<RequestGroup>;
    }) => {
      const url = href(
        '/organization/:organizationId/project/:projectId/workspace/:workspaceId/debug/request-group/duplicate',
        {
          organizationId,
          projectId,
          workspaceId,
        },
      );

      return submit(JSON.stringify(requestGroupData), {
        action: url,
        method: 'POST',
        encType: 'application/json',
      });
    },
  clientAction,
);
