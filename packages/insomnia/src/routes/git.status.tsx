import { href } from 'react-router';

import { createFetcherSubmitHook } from '~/utils/router';

import type { Route } from './+types/git.status';

interface GitStatusData {
  workspaceId?: string;
  projectId: string;
}

export async function clientAction({ request }: Route.ClientActionArgs) {
  const data = (await request.json()) as GitStatusData;

  return window.main.git.gitStatus(data);
}

export const useGitProjectStatusActionFetcher = createFetcherSubmitHook(
  submit => (data: GitStatusData) => {
    return submit(JSON.stringify(data), {
      method: 'POST',
      action: href('/git/status'),
      encType: 'application/json',
    });
  },
  clientAction,
);
