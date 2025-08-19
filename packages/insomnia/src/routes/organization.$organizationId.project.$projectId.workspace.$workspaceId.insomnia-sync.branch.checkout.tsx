import { useCallback } from 'react';
import { href, redirect, useFetcher } from 'react-router';

import type { Operation } from '~/common/database';
import { database } from '~/common/database';
import { VCSInstance } from '~/sync/vcs/insomnia-sync';
import { getSyncItems, remoteCompareCache } from '~/ui/sync-utils';
import { invariant } from '~/utils/invariant';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.insomnia-sync.branch.checkout';

export async function clientAction({ request, params }: Route.ClientActionArgs) {
  const { organizationId, projectId, workspaceId } = params;

  const formData = await request.formData();

  const branch = formData.get('branch');
  invariant(typeof branch === 'string', 'Branch is required');

  const vcs = VCSInstance();
  const { syncItems } = await getSyncItems({ workspaceId });

  try {
    const delta = await vcs.checkout(syncItems, branch);
    await database.batchModifyDocs(delta as Operation);
    delete remoteCompareCache[workspaceId];
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error while checking out branch.';

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

export function useInsomniaSyncBranchCheckoutActionFetcher(args?: Parameters<typeof useFetcher>[0]) {
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
          `/organization/:organizationId/project/:projectId/workspace/:workspaceId/insomnia-sync/branch/checkout`,
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
