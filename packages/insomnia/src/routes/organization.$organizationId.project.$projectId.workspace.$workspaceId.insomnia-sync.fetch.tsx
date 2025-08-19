import { useCallback } from 'react';
import { href, useFetcher } from 'react-router';

import { database } from '~/common/database';
import * as models from '~/models';
import { VCSInstance } from '~/sync/vcs/insomnia-sync';
import { invariant } from '~/utils/invariant';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.insomnia-sync.fetch';

export async function clientAction({ request, params }: Route.ClientActionArgs) {
  const { projectId } = params;

  const project = await models.project.getById(projectId);
  invariant(project, 'Project not found');

  const formData = await request.formData();
  const branch = formData.get('branch');
  invariant(typeof branch === 'string', 'Branch is required');
  const vcs = VCSInstance();
  const currentBranch = await vcs.getCurrentBranchName();

  try {
    invariant(project.remoteId, 'Project is not remote');
    await vcs.checkout([], branch);
    const delta = await vcs.pull({
      candidates: [],
      teamId: project.parentId,
      teamProjectId: project.remoteId,
      projectId,
    });

    await database.batchModifyDocs(delta);
  } catch (err) {
    await vcs.checkout([], currentBranch);
    const errorMessage = err instanceof Error ? err.message : 'Unknown error while fetching remote branch.';
    return {
      error: errorMessage,
    };
  }

  return null;
}

export function useInsomniaSyncFetchActionFetcher(args?: Parameters<typeof useFetcher>[0]) {
  const { submit: fetcherSubmit, ...fetcherRest } = useFetcher<typeof clientAction>(args);

  const submit = useCallback(
    ({
      organizationId,
      projectId,
      workspaceId,
      branch,
    }: {
      organizationId: string;
      projectId: string;
      workspaceId: string;
      branch: string;
    }) => {
      return fetcherSubmit(
        {
          branch,
        },
        {
          method: 'POST',
          action: href('/organization/:organizationId/project/:projectId/workspace/:workspaceId/insomnia-sync/fetch', {
            organizationId,
            projectId,
            workspaceId,
          }),
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
