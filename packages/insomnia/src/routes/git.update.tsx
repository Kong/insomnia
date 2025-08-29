import { useCallback } from 'react';
import { href, useFetcher } from 'react-router';

import type { GitCredentials } from '~/models/git-repository';

import type { Route } from './+types/git.update';

interface UpdateGitRepoData {
  author: {
    email: string;
    name: string;
  };
  credentials: GitCredentials;
  uri: string;
  workspaceId?: string;
  projectId: string;
}

export async function clientAction({ request }: Route.ClientActionArgs) {
  const data = (await request.json()) as UpdateGitRepoData;

  return window.main.git.updateGitRepo(data);
}

export function useGitProjectUpdateActionFetcher(args?: Parameters<typeof useFetcher>[0]) {
  const { submit: fetcherSubmit, ...fetcherRest } = useFetcher<typeof clientAction>(args);

  const submit = useCallback(
    (data: UpdateGitRepoData) => {
      return fetcherSubmit(JSON.stringify(data), {
        method: 'POST',
        action: href(`/git/update`),
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
