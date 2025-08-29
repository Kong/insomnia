import { useCallback } from 'react';
import { href, redirect, useFetcher } from 'react-router';

import type { Operation } from '~/common/database';
import { database } from '~/common/database';
import { VCSInstance } from '~/sync/vcs/insomnia-sync';
import { getSyncItems, remoteCompareCache } from '~/ui/sync-utils';

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

  return redirect(
    href('/organization/:organizationId/project/:projectId/workspace/:workspaceId/debug', {
      organizationId,
      projectId,
      workspaceId,
    }),
  );
}

export function useInsomniaSyncRollbackActionFetcher(args?: Parameters<typeof useFetcher>[0]) {
  const { submit: fetcherSubmit, ...fetcherRest } = useFetcher<typeof clientAction>(args);

  const submit = useCallback(
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

      return fetcherSubmit(
        {},
        {
          action: url,
          method: 'POST',
        },
      );
    },
    [fetcherSubmit],
  );

  return {
    ...fetcherRest,
    submit,
  };
}
