import type { WorkspaceMeta } from 'insomnia-data';
import { services } from 'insomnia-data';
import { href } from 'react-router';

import { createFetcherSubmitHook } from '~/utils/router';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.update-meta';

export async function clientAction({ request, params }: Route.ClientActionArgs) {
  const { workspaceId } = params;

  const patch = (await request.json()) as Partial<WorkspaceMeta>;

  await services.workspaceMeta.updateByParentId(workspaceId, patch);

  return null;
}

export const useWorkspaceUpdateMetaActionFetcher = createFetcherSubmitHook(
  submit =>
    ({
      organizationId,
      projectId,
      workspaceId,
      patch,
    }: {
      organizationId: string;
      projectId: string;
      workspaceId: string;
      patch: Partial<WorkspaceMeta>;
    }) => {
      return submit(JSON.stringify(patch), {
        method: 'POST',
        action: href(`/organization/:organizationId/project/:projectId/workspace/:workspaceId/update-meta`, {
          organizationId,
          projectId,
          workspaceId,
        }),
        encType: 'application/json',
      });
    },
  clientAction,
);
