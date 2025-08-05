import { useCallback } from 'react';
import { href, useFetcher } from 'react-router';

import type { Operation } from '~/common/database';
import { database } from '~/common/database';
import { VCSInstance } from '~/sync/vcs/insomnia-sync';
import { getSyncItems, remoteCompareCache } from '~/ui/sync-utils';
import { invariant } from '~/utils/invariant';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.insomnia-sync.branch.delete';

export async function clientAction({ request, params }: Route.ClientActionArgs) {
  const { workspaceId } = params;

  const formData = await request.formData();

  const branchName = formData.get('branchName');
  invariant(typeof branchName === 'string', 'Branch is required');

  const { syncItems } = await getSyncItems({ workspaceId });

  try {
    const vcs = VCSInstance();
    await vcs.fork(branchName);
    // Checkout new branch
    const delta = await vcs.checkout(syncItems, branchName);
    await database.batchModifyDocs(delta as Operation);
    delete remoteCompareCache[workspaceId];
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error while merging branch.';

    return {
      error: errorMessage,
    };
  }

  return null;
}

export function useInsomniaSyncBranchCreateActionFetcher(args?: Parameters<typeof useFetcher>[0]) {
  const { submit: fetcherSubmit, ...fetcherRest } = useFetcher<typeof clientAction>(args);

  const submit = useCallback(
    (branchName: string, organizationId: string, projectId: string, workspaceId: string) => {
      const formData = new FormData();
      formData.set('branchName', branchName);

      return fetcherSubmit(formData, {
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
    [fetcherSubmit],
  );

  return {
    ...fetcherRest,
    submit,
  };
}
