import { models, services } from 'insomnia-data';
import { href, redirect } from 'react-router';

import type { Operation } from '~/common/database';
import { database } from '~/common/database';
import { invariant } from '~/common/utils/invariant';
import { getSyncItems, remoteCompareCache, reparentSyncDelta } from '~/ui/sync-utils';
import { createFetcherSubmitHook } from '~/ui/utils/router';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.insomnia-sync.rollback';

export async function clientAction({ params }: Route.ClientActionArgs) {
  const { organizationId, projectId, workspaceId } = params;

  try {
    const { syncItems } = await getSyncItems({ workspaceId });
    const delta = (await window.main.sync.rollbackToLatest(syncItems)) as unknown as Operation;
    // This is to synchronize the local database with the branch changes
    await database.batchModifyDocs(reparentSyncDelta(delta, projectId));
    delete remoteCompareCache[workspaceId];
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error while rolling back changes.';
    return {
      error: errorMessage,
    };
  }

  const workspace = await services.workspace.getById(workspaceId);
  invariant(workspace, 'Workspace not found');

  return redirect(
    `${href('/organization/:organizationId/project/:projectId/workspace/:workspaceId', {
      organizationId,
      projectId,
      workspaceId,
    })}/${models.workspace.scopeToActivity(workspace?.scope)}`,
  );
}

export const useInsomniaSyncRollbackActionFetcher = createFetcherSubmitHook(
  submit =>
    ({
      organizationId,
      projectId,
      workspaceId,
    }: {
      organizationId: string;
      projectId: string;
      workspaceId: string;
    }) => {
      const url = href(
        '/organization/:organizationId/project/:projectId/workspace/:workspaceId/insomnia-sync/rollback',
        {
          organizationId,
          projectId,
          workspaceId,
        },
      );

      return submit(
        {},
        {
          action: url,
          method: 'POST',
        },
      );
    },
  clientAction,
);
