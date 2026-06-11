import { models, services } from 'insomnia-data';
import { href, redirect } from 'react-router';

import type { Operation } from '~/common/database';
import { database } from '~/common/database';
import { getSyncItems, remoteCompareCache, reparentSyncDelta } from '~/ui/sync-utils';
import { invariant } from '~/utils/invariant';
import { createFetcherSubmitHook } from '~/utils/router';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.insomnia-sync.restore';

export async function clientAction({ request, params }: Route.ClientActionArgs) {
  const { organizationId, projectId, workspaceId } = params;

  const formData = await request.formData();
  const id = formData.get('id');
  invariant(typeof id === 'string', 'Id is required');
  try {
    const { syncItems } = await getSyncItems({ workspaceId });
    const delta = (await window.main.sync.rollback(id, syncItems)) as unknown as Operation;
    // This is to synchronize the local database with the branch changes
    await database.batchModifyDocs(reparentSyncDelta(delta, projectId));
    delete remoteCompareCache[workspaceId];
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error while restoring changes.';
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

export const useInsomniaSyncRestoreActionFetcher = createFetcherSubmitHook(
  submit =>
    ({
      id,
      organizationId,
      projectId,
      workspaceId,
    }: {
      id: string;
      organizationId: string;
      projectId: string;
      workspaceId: string;
    }) => {
      const formData = new FormData();
      formData.set('id', id);

      return submit(formData, {
        method: 'POST',
        action: href(`/organization/:organizationId/project/:projectId/workspace/:workspaceId/insomnia-sync/restore`, {
          organizationId,
          projectId,
          workspaceId,
        }),
      });
    },
  clientAction,
);
