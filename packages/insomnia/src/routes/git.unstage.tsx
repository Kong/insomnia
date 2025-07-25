import { href, useFetcher } from 'react-router';

import type { Route } from './+types/git.unstage';

interface UnstageGitChangesData {
  paths: string[];
  projectId: string;
  workspaceId?: string;
}

export async function clientAction({ request }: Route.ClientActionArgs) {
  const data = (await request.json()) as UnstageGitChangesData;

  return window.main.git.unstageChanges(data);
}

export function useGitProjectUnstageActionFetcher(args?: Parameters<typeof useFetcher>[0]) {
  const fetcher = useFetcher<typeof clientAction>(args);

  function submit(data: UnstageGitChangesData) {
    return fetcher.submit(JSON.stringify(data), {
      method: 'POST',
      action: href('/git/unstage'),
      encType: 'application/json',
    });
  }

  return {
    ...fetcher,
    submit,
  };
}
