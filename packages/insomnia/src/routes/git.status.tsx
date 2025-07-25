import { href, useFetcher } from 'react-router';

import type { Route } from './+types/git.status';

interface GitStatusData {
  workspaceId?: string;
  projectId: string;
}

export async function clientAction({ request }: Route.ClientActionArgs) {
  const data = (await request.json()) as GitStatusData;

  return window.main.git.gitStatus(data);
}

export function useGitProjectStatusActionFetcher(args?: Parameters<typeof useFetcher>[0]) {
  const fetcher = useFetcher<typeof clientAction>(args);

  function submit(data: GitStatusData) {
    return fetcher.submit(JSON.stringify(data), {
      method: 'POST',
      action: href('/git/status'),
      encType: 'application/json',
    });
  }

  return {
    ...fetcher,
    submit,
  };
}
