import { href } from 'react-router';

import type { GitCredentials } from '~/models/git-repository';
import { createFetcherSubmitHook } from '~/utils/router';

import type { Route } from './+types/git.remote-branches';

interface FetchRemoteBranchesData {
  uri: string;
  credentials: GitCredentials;
}

export async function clientAction({ request }: Route.ClientActionArgs) {
  const data = (await request.json()) as FetchRemoteBranchesData;

  return window.main.git.fetchGitRemoteBranches(data);
}

export const useGitRemoteBranchesActionFetcher = createFetcherSubmitHook(
  submit => (data: FetchRemoteBranchesData) => {
    return submit(JSON.stringify(data), {
      method: 'POST',
      action: href(`/git/remote-branches`),
      encType: 'application/json',
    });
  },
  clientAction,
);
