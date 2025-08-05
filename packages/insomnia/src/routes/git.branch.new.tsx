import { useCallback } from 'react';
import { href, useFetcher } from 'react-router';

import { invariant } from '~/utils/invariant';

import type { Route } from './+types/git.branch.new';

interface NewGitBranchData {
  branch: string;
  projectId: string;
  workspaceId?: string;
}

export async function clientAction({ request }: Route.ClientActionArgs) {
  const data = (await request.json()) as NewGitBranchData;

  invariant(typeof data.branch === 'string', 'Branch is required');

  return window.main.git.createNewGitBranch(data);
}

export function useGitProjectNewBranchActionFetcher(args?: Parameters<typeof useFetcher>[0]) {
  const { submit: fetcherSubmit, ...fetcherRest } = useFetcher<typeof clientAction>(args);

  const submit = useCallback(
    (data: NewGitBranchData) => {
      return fetcherSubmit(JSON.stringify(data), {
        method: 'POST',
        action: href('/git/branch/new'),
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
