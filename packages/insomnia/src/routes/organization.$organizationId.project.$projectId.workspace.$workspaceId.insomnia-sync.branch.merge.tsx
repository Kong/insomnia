import { href } from 'react-router';

import type { Operation } from '~/common/database';
import { database } from '~/common/database';
import { UserAbortResolveMergeConflictError } from '~/sync/vcs/errors';
import { getSyncItems, remoteCompareCache, reparentSyncDelta } from '~/ui/sync-utils';
import { invariant } from '~/utils/invariant';
import { createFetcherSubmitHook } from '~/utils/router';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.insomnia-sync.branch.merge';

export async function clientAction({ request, params }: Route.ClientActionArgs) {
  const { projectId, workspaceId } = params;

  const formData = await request.formData();
  const branch = formData.get('branch');
  invariant(typeof branch === 'string', 'Branch is required');
  const { syncItems } = await getSyncItems({ workspaceId });
  let delta;
  try {
    delta = await window.main.sync.merge(syncItems, branch);
  } catch (err) {
    if (err instanceof UserAbortResolveMergeConflictError) {
      return null;
    }
    throw err;
  }
  try {
    // This is to synchronize the local database with the branch changes
    await database.batchModifyDocs(reparentSyncDelta(delta as Operation, projectId));
    delete remoteCompareCache[workspaceId];
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error while merging branch.';
    return {
      error: errorMessage,
    };
  }

  return null;
}

export const useInsomniaSyncBranchMergeActionFetcher = createFetcherSubmitHook(
  submit =>
    ({
      branch,
      organizationId,
      projectId,
      workspaceId,
    }: {
      branch: string;
      organizationId: string;
      projectId: string;
      workspaceId: string;
    }) => {
      const formData = new FormData();
      formData.set('branch', branch);

      return submit(formData, {
        method: 'POST',
        action: href(
          `/organization/:organizationId/project/:projectId/workspace/:workspaceId/insomnia-sync/branch/merge`,
          {
            organizationId,
            projectId,
            workspaceId,
          },
        ),
      });
    },
  clientAction,
);
