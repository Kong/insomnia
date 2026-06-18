import { href } from 'react-router';

import type { Operation } from '~/common/database';
import { database } from '~/common/database';
import { invariant } from '~/common/utils/invariant';
import { getSyncItems, remoteCompareCache, reparentSyncDelta } from '~/ui/sync-utils';
import { createFetcherSubmitHook } from '~/ui/utils/router';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.insomnia-sync.branch.delete';

export async function clientAction({ request, params }: Route.ClientActionArgs) {
  const { projectId, workspaceId } = params;

  const formData = await request.formData();

  const branchName = formData.get('branchName');
  invariant(typeof branchName === 'string', 'Branch is required');

  const { syncItems } = await getSyncItems({ workspaceId });

  try {
    await window.main.sync.fork(branchName);
    // Checkout new branch
    const delta = (await window.main.sync.checkout(syncItems, branchName)) as Operation;
    // This is to synchronize the local database with the branch changes
    await database.batchModifyDocs(reparentSyncDelta(delta, projectId));
    delete remoteCompareCache[workspaceId];
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error while merging branch.';

    return {
      error: errorMessage,
    };
  }

  return null;
}

export const useInsomniaSyncBranchCreateActionFetcher = createFetcherSubmitHook(
  submit => (branchName: string, organizationId: string, projectId: string, workspaceId: string) => {
    const formData = new FormData();
    formData.set('branchName', branchName);

    return submit(formData, {
      method: 'POST',
      action: href(
        `/organization/:organizationId/project/:projectId/workspace/:workspaceId/insomnia-sync/branch/create`,
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
