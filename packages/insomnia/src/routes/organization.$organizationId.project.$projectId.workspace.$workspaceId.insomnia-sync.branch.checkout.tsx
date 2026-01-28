import { href, redirect } from 'react-router';

import type { Operation } from '~/common/database';
import { database } from '~/common/database';
import * as models from '~/models';
import { scopeToActivity } from '~/models/workspace';
import { VCSInstance } from '~/sync/vcs/insomnia-sync';
import { getSyncItems, remoteCompareCache } from '~/ui/sync-utils';
import { invariant } from '~/utils/invariant';
import { createFetcherSubmitHook } from '~/utils/router';

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
    // This is to synchronize the local database with the branch changes
    await database.batchModifyDocs(delta as Operation);
    delete remoteCompareCache[workspaceId];
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error while checking out branch.';

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

export const useInsomniaSyncBranchCheckoutActionFetcher = createFetcherSubmitHook(
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
          `/organization/:organizationId/project/:projectId/workspace/:workspaceId/insomnia-sync/branch/checkout`,
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
