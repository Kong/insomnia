import { href } from 'react-router';

import { database } from '~/common/database';
import { services } from '~/insomnia-data';
import { reparentSyncDelta } from '~/ui/sync-utils';
import { invariant } from '~/utils/invariant';
import { createFetcherSubmitHook } from '~/utils/router';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.insomnia-sync.fetch';

export async function clientAction({ request, params }: Route.ClientActionArgs) {
  const { projectId } = params;

  const project = await services.project.get(projectId);
  invariant(project, 'Project not found');

  const formData = await request.formData();
  const branch = formData.get('branch');
  invariant(typeof branch === 'string', 'Branch is required');
  const currentBranch = await window.main.sync.getCurrentBranchName();

  try {
    invariant(project.remoteId, 'Project is not remote');
    await window.main.sync.checkout([], branch);
    const delta = await window.main.sync.pull({
      candidates: [],
      teamId: project.parentId,
      teamProjectId: project.remoteId,
      projectId,
    });

    // This is to synchronize the local database with the branch changes
    await database.batchModifyDocs(reparentSyncDelta(delta, projectId));
  } catch (err) {
    await window.main.sync.checkout([], currentBranch);
    const errorMessage = err instanceof Error ? err.message : 'Unknown error while fetching remote branch.';
    return {
      error: errorMessage,
    };
  }

  return null;
}

export const useInsomniaSyncFetchActionFetcher = createFetcherSubmitHook(
  submit =>
    ({
      organizationId,
      projectId,
      workspaceId,
      branch,
    }: {
      organizationId: string;
      projectId: string;
      workspaceId: string;
      branch: string;
    }) => {
      return submit(
        {
          branch,
        },
        {
          method: 'POST',
          action: href('/organization/:organizationId/project/:projectId/workspace/:workspaceId/insomnia-sync/fetch', {
            organizationId,
            projectId,
            workspaceId,
          }),
        },
      );
    },
  clientAction,
);
