import { href } from 'react-router';

import { createFetcherSubmitHook } from '~/ui/utils/router';

import type { Route } from './+types/git.commit';

interface CommitGitRepoData {
  projectId: string;
  workspaceId?: string;
  commits: {
    message: string;
    files: string[];
  }[];
  push?: boolean;
}

export async function clientAction({ request }: Route.ClientActionArgs) {
  const data = (await request.json()) as CommitGitRepoData;

  if (data.push) {
    // Validate credentials before committing to prevent orphaned local commits
    // when the subsequent push would fail due to authentication issues.
    const validationResult = await window.main.git.validateGitRepositoryCredentials({
      projectId: data.projectId,
      workspaceId: data.workspaceId,
    });
    if (validationResult.errors && validationResult.errors.length > 0) {
      return validationResult;
    }
  }

  await window.main.git.multipleCommitToGitRepo({
    projectId: data.projectId,
    workspaceId: data.workspaceId,
    commits: data.commits,
  });

  if (data.push) {
    // For push, we need to use the standard push action since all commits are already made
    return window.main.git.pushToGitRemote({
      projectId: data.projectId,
      workspaceId: data.workspaceId,
    });
  }

  return {
    errors: [],
  };
}

export const useGitProjectCommitsActionFetcher = createFetcherSubmitHook(
  submit => (data: CommitGitRepoData) => {
    return submit(JSON.stringify(data), {
      action: href('/git/commits'),
      method: 'POST',
      encType: 'application/json',
    });
  },
  clientAction,
);
