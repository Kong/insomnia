import { href } from 'react-router';

import { createFetcherSubmitHook } from '~/utils/router';

import type { Route } from './+types/git.update';

interface UpdateGitRepoData {
  credentialsId: string | null;
  uri: string;
  workspaceId?: string;
  projectId: string;
  selectedAuthorEmail?: string | null;
}

export async function clientAction({ request }: Route.ClientActionArgs) {
  const data = (await request.json()) as UpdateGitRepoData;

  return window.main.git.updateGitRepo(data);
}

export const useGitProjectUpdateActionFetcher = createFetcherSubmitHook(
  submit => (data: UpdateGitRepoData) => {
    return submit(JSON.stringify(data), {
      method: 'POST',
      action: href(`/git/update`),
      encType: 'application/json',
    });
  },
  clientAction,
);
