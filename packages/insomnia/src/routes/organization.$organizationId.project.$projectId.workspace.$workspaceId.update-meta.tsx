import { href, useFetcher } from 'react-router';

import * as models from '~/models';
import type { WorkspaceMeta } from '~/models/workspace-meta';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.update-meta';

export async function clientAction({ request, params }: Route.ClientActionArgs) {
  const { workspaceId } = params;

  const patch = (await request.json()) as Partial<WorkspaceMeta>;

  await models.workspaceMeta.updateByParentId(workspaceId, patch);

  return null;
}

export function useWorkspaceUpdateMetaActionFetcher(args?: Parameters<typeof useFetcher>[0]) {
  const fetcher = useFetcher<typeof clientAction>(args);

  function submit({
    organizationId,
    projectId,
    workspaceId,
    patch,
  }: {
    organizationId: string;
    projectId: string;
    workspaceId: string;
    patch: Partial<WorkspaceMeta>;
  }) {
    return fetcher.submit(JSON.stringify(patch), {
      method: 'POST',
      action: href(`/organization/:organizationId/project/:projectId/workspace/:workspaceId/update-meta`, {
        organizationId,
        projectId,
        workspaceId,
      }),
      encType: 'application/json',
    });
  }

  return {
    ...fetcher,
    submit,
  };
}
