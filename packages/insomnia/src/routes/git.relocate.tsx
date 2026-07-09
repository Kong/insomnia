import { href } from 'react-router';

import { createFetcherSubmitHook } from '~/ui/utils/router';

import type { Route } from './+types/git.relocate';

interface RelocateGitRepoParams {
  gitRepositoryId: string;
  projectId: string;
  newDirectory: string;
}

export async function clientAction({ request }: Route.ClientActionArgs) {
  const data = (await request.json()) as RelocateGitRepoParams;

  return window.main.git.relocateGitRepo(data);
}

export const useGitProjectRelocateActionFetcher = createFetcherSubmitHook(
  submit => (data: RelocateGitRepoParams) => {
    return submit(JSON.stringify(data), {
      method: 'POST',
      action: href('/git/relocate'),
      encType: 'application/json',
    });
  },
  clientAction,
);
