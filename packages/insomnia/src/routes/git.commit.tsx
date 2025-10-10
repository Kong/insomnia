import { href } from 'react-router';

import { invariant } from '~/utils/invariant';
import { createFetcherSubmitHook } from '~/utils/router';

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

export const useGitProjectCommitActionFetcher = createFetcherSubmitHook(
  submit => (data: CommitGitRepoData) => {
    return submit(JSON.stringify(data), {
      action: href('/git/commit'),
      method: 'POST',
      encType: 'application/json',
    });
  },
  clientAction,
);
