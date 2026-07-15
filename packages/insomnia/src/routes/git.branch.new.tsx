import { href } from 'react-router';

import { invariant } from '~/common/utils/invariant';
import { createFetcherSubmitHook } from '~/ui/utils/router';

import type { Route } from './+types/git.branch.new';

interface NewGitBranchData {
  branch: string;
  projectId: string;
  workspaceId?: string;
}

export async function clientAction({ request }: Route.ClientActionArgs) {
  const data = (await request.json()) as NewGitBranchData;

  invariant(typeof data.branch === 'string', 'Branch is required');

  return window.main.git.createNewGitBranch(data);
}

export const useGitProjectNewBranchActionFetcher = createFetcherSubmitHook(
  submit => (data: NewGitBranchData) => {
    return submit(JSON.stringify(data), {
      method: 'POST',
      action: href('/git/branch/new'),
      encType: 'application/json',
    });
  },
  clientAction,
);
