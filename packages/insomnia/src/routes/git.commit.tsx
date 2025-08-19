import { useCallback } from 'react';
import { href, useFetcher } from 'react-router';

import { invariant } from '~/utils/invariant';

import type { Route } from './+types/git.commit';

interface CommitGitRepoData {
  projectId: string;
  workspaceId?: string;
  message: string;
  push?: boolean;
}

export async function clientAction({ request }: Route.ClientActionArgs) {
  const data = (await request.json()) as CommitGitRepoData;

  invariant(typeof data.message === 'string', 'Message is required');

  if (data.push) {
    return window.main.git.commitAndPushToGitRepo(data);
  }

  return window.main.git.commitToGitRepo(data);
}

export function useGitProjectCommitActionFetcher(args?: Parameters<typeof useFetcher>[0]) {
  const {
    submit: fetcherSubmit,
    ...fetcherRest
  } = useFetcher<typeof clientAction>(args);

  const submit = useCallback((data: CommitGitRepoData) => {
    return fetcherSubmit(JSON.stringify(data), {
      action: href('/git/commit'),
      method: 'POST',
      encType: 'application/json',
    });
  }, [fetcherSubmit]);

  return {
    ...fetcherRest,
    submit,
  };
}
