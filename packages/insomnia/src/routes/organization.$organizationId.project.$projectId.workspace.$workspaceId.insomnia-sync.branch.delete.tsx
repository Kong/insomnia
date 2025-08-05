import { useCallback } from 'react';
import { href, redirect, useFetcher } from 'react-router';

import { VCSInstance } from '~/sync/vcs/insomnia-sync';
import { remoteBranchesCache } from '~/ui/sync-utils';
import { invariant } from '~/utils/invariant';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.insomnia-sync.branch.delete';

export async function clientAction({ request, params }: Route.ClientActionArgs) {
  const { organizationId, projectId, workspaceId } = params;

  const formData = await request.formData();
  const branch = formData.get('branch');
  invariant(typeof branch === 'string', 'Branch is required');

  try {
    const vcs = VCSInstance();
    await vcs.removeRemoteBranch(branch);
    try {
      await vcs.removeBranch(branch);
    } catch (err) {
      // Branch doesn't exist locally, ignore
    }

    delete remoteBranchesCache[workspaceId];
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error while merging branch.';
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

export function useInsomniaSyncBranchDeleteActionFetcher(args?: Parameters<typeof useFetcher>[0]) {
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
          `/organization/:organizationId/project/:projectId/workspace/:workspaceId/insomnia-sync/branch/delete`,
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
