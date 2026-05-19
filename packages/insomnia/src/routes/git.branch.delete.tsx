import { href } from 'react-router';

import { invariant } from '~/insomnia-data/common';
import { createFetcherSubmitHook } from '~/utils/router';

import type { Route } from './+types/git.branch.delete';

interface DeleteGitBranchData {
  branch: string;
  projectId: string;
  workspaceId?: string;
}

export async function clientAction({ request }: Route.ClientActionArgs) {
  const data = (await request.json()) as DeleteGitBranchData;

  invariant(typeof data.branch === 'string', 'Branch is required');

  return window.main.git.deleteGitBranch(data);
}

export const useGitProjectDeleteBranchActionFetcher = createFetcherSubmitHook(
  submit => (data: DeleteGitBranchData) => {
    return submit(JSON.stringify(data), {
      method: 'POST',
      action: href('/git/branch/delete'),
      encType: 'application/json',
    });
  },
  clientAction,
);
