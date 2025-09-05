import { href } from 'react-router';

import { createFetcherSubmitHook } from '~/utils/router';

import type { Route } from './+types/git.reset';

interface ResetGitRepoParams {
  projectId: string;
  workspaceId?: string;
}

export async function clientAction({ request }: Route.ClientActionArgs) {
  const data = (await request.json()) as ResetGitRepoParams;

  return window.main.git.resetGitRepo(data);
}

export const useGitProjectResetActionFetcher = createFetcherSubmitHook(
  submit => (data: ResetGitRepoParams) => {
    return submit(JSON.stringify(data), {
      method: 'POST',
      action: href('/git/reset'),
      encType: 'application/json',
    });
  },
  clientAction,
);
