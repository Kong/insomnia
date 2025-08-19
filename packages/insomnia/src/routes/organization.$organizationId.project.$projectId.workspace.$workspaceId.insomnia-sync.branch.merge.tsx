import { useCallback } from 'react';
import { href, useFetcher } from 'react-router';

import type { Operation } from '~/common/database';
import { database } from '~/common/database';
import { UserAbortResolveMergeConflictError, VCSInstance } from '~/sync/vcs/insomnia-sync';
import { getSyncItems, remoteCompareCache } from '~/ui/sync-utils';
import { invariant } from '~/utils/invariant';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.insomnia-sync.branch.merge';

export async function clientAction({ request, params }: Route.ClientActionArgs) {
  const { workspaceId } = params;

  const formData = await request.formData();
  const branch = formData.get('branch');
  invariant(typeof branch === 'string', 'Branch is required');
  const vcs = VCSInstance();
  const { syncItems } = await getSyncItems({ workspaceId });
  let delta;
  try {
    delta = await vcs.merge(syncItems, branch);
  } catch (err) {
    if (err instanceof UserAbortResolveMergeConflictError) {
      return null;
    }
    throw err;
  }
  try {
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

export function useInsomniaSyncBranchMergeActionFetcher(args?: Parameters<typeof useFetcher>[0]) {
  const { submit: fetcherSubmit, ...fetcherRest } = useFetcher<typeof clientAction>(args);

  const submit = useCallback(
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

      return fetcherSubmit(formData, {
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
    [fetcherSubmit],
  );

  return {
    ...fetcherRest,
    submit,
  };
}
