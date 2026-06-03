import { models, services } from 'insomnia-data';
import { href, redirect } from 'react-router';

import { remoteBranchesCache } from '~/ui/sync-utils';
import { invariant } from '~/utils/invariant';
import { createFetcherSubmitHook } from '~/utils/router';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.insomnia-sync.branch.delete';

export async function clientAction({ request, params }: Route.ClientActionArgs) {
  const { organizationId, projectId, workspaceId } = params;

  const formData = await request.formData();
  const branch = formData.get('branch');
  invariant(typeof branch === 'string', 'Branch is required');

  try {
    await window.main.sync.removeRemoteBranch(branch);
    try {
      await window.main.sync.removeBranch(branch);
    } catch {
      // Branch doesn't exist locally, ignore
    }

    delete remoteBranchesCache[workspaceId];
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error while merging branch.';
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

export const useInsomniaSyncBranchDeleteActionFetcher = createFetcherSubmitHook(
  submit =>
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

      return submit(formData, {
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
  clientAction,
);
