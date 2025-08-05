import { useCallback } from 'react';
import { href, redirect, useFetcher } from 'react-router';

import type { Operation } from '~/common/database';
import { database } from '~/common/database';
import { VCSInstance } from '~/sync/vcs/insomnia-sync';
import { getSyncItems, remoteCompareCache } from '~/ui/sync-utils';
import { invariant } from '~/utils/invariant';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.insomnia-sync.restore';

export async function clientAction({ request, params }: Route.ClientActionArgs) {
  const { organizationId, projectId, workspaceId } = params;

  const formData = await request.formData();
  const id = formData.get('id');
  invariant(typeof id === 'string', 'Id is required');
  try {
    const vcs = VCSInstance();
    const { syncItems } = await getSyncItems({ workspaceId });
    const delta = await vcs.rollback(id, syncItems);
    await database.batchModifyDocs(delta as unknown as Operation);
    delete remoteCompareCache[workspaceId];
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error while restoring changes.';
    return {
      error: errorMessage,
    };
  }

  return redirect(
    href(`/organization/:organizationId/project/:projectId/workspace/:workspaceId/debug`, {
      organizationId,
      projectId,
      workspaceId,
    }),
  );
}

export function useInsomniaSyncRestoreActionFetcher(args?: Parameters<typeof useFetcher>[0]) {
  const { submit: fetcherSubmit, ...fetcherRest } = useFetcher<typeof clientAction>(args);

  const submit = useCallback(
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

      return fetcherSubmit(formData, {
        method: 'POST',
        action: href(`/organization/:organizationId/project/:projectId/workspace/:workspaceId/insomnia-sync/restore`, {
          organizationId,
          projectId,
          workspaceId,
        }),
      });
    },
    [fetcherSubmit],
  );

  return {
    ...fetcherRest,
    submit,
  };
}
