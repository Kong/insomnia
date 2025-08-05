import { useCallback } from 'react';
import { href, useFetcher } from 'react-router';

import type { GitCredentials } from '~/models/git-repository';

import type { Route } from './+types/git.remote-branches';

interface FetchRemoteBranchesData {
  uri: string;
  credentials: GitCredentials;
}

export async function clientAction({ request }: Route.ClientActionArgs) {
  const data = (await request.json()) as FetchRemoteBranchesData;

  return window.main.git.fetchGitRemoteBranches(data);
}

export function useGitRemoteBranchesActionFetcher(args?: Parameters<typeof useFetcher>[0]) {
  const { submit: fetcherSubmit, ...fetcherRest } = useFetcher<typeof clientAction>(args);

  const submit = useCallback(
    (data: FetchRemoteBranchesData) => {
      return fetcherSubmit(JSON.stringify(data), {
        method: 'POST',
        action: href(`/git/remote-branches`),
        encType: 'application/json',
      });
    },
    [fetcherSubmit],
  );

  return {
    ...fetcherRest,
    submit,
  };
}
