import { href, useFetcher } from 'react-router';

import type { Route } from './+types/git.reset';

interface ResetGitRepoParams {
  projectId: string;
  workspaceId?: string;
}

export async function clientAction({ request }: Route.ClientActionArgs) {
  const data = (await request.json()) as ResetGitRepoParams;

  return window.main.git.resetGitRepo(data);
}

export function useGitProjectResetActionFetcher(args?: Parameters<typeof useFetcher>[0]) {
  const fetcher = useFetcher<typeof clientAction>(args);

  function submit(data: ResetGitRepoParams) {
    return fetcher.submit(JSON.stringify(data), {
      method: 'POST',
      action: href('/git/reset'),
      encType: 'application/json',
    });
  }

  return {
    ...fetcher,
    submit,
  };
}
