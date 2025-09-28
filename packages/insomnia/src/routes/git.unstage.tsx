import { href } from 'react-router';

import { createFetcherSubmitHook } from '~/utils/router';

import type { Route } from './+types/git.unstage';

interface UnstageGitChangesData {
  paths: string[];
  projectId: string;
  workspaceId?: string;
}

export async function clientAction({ request }: Route.ClientActionArgs) {
  const data = (await request.json()) as UnstageGitChangesData;

  return window.main.git.unstageChanges(data);
}

export const useGitProjectUnstageActionFetcher = createFetcherSubmitHook(
  submit => (data: UnstageGitChangesData) => {
    return submit(JSON.stringify(data), {
      method: 'POST',
      action: href('/git/unstage'),
      encType: 'application/json',
    });
  },
  clientAction,
);
