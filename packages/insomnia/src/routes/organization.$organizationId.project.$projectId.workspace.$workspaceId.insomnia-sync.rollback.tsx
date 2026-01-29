import { href, redirect } from 'react-router';

import type { Operation } from '~/common/database';
import { database } from '~/common/database';
import * as models from '~/models';
import { scopeToActivity } from '~/models/workspace';
import { VCSInstance } from '~/sync/vcs/insomnia-sync';
import { getSyncItems, remoteCompareCache } from '~/ui/sync-utils';
import { invariant } from '~/utils/invariant';
import { createFetcherSubmitHook } from '~/utils/router';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.insomnia-sync.rollback';

export async function clientAction({ params }: Route.ClientActionArgs) {
  const { organizationId, projectId, workspaceId } = params;

  try {
    const vcs = VCSInstance();
    const { syncItems } = await getSyncItems({ workspaceId });
    const delta = await vcs.rollbackToLatest(syncItems);
    // This is to synchronize the local database with the branch changes
    await database.batchModifyDocs(delta as unknown as Operation);
    delete remoteCompareCache[workspaceId];
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error while rolling back changes.';
    return {
      error: errorMessage,
    };
  }

  const workspace = await models.workspace.getById(workspaceId);
  invariant(workspace, 'Workspace not found');

  return redirect(
    `${href('/organization/:organizationId/project/:projectId/workspace/:workspaceId', {
      organizationId,
      projectId,
      workspaceId,
    })}/${scopeToActivity(workspace?.scope)}`,
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
