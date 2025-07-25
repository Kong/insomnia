import { href, useFetcher } from 'react-router';

import type { Route } from './+types/git.changes';

export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  const url = new URL(request.url);
  const params = Object.fromEntries(url.searchParams.entries());
  const workspaceId = params.workspaceId;
  const projectId = params.projectId;

  return window.main.git.gitChangesLoader({
    projectId,
    workspaceId,
  });
}

export function useGitProjectChangesFetcher(args?: Parameters<typeof useFetcher>[0]) {
  const fetcher = useFetcher<typeof clientLoader>(args);
  function load({ projectId, workspaceId }: { projectId: string; workspaceId?: string }) {
    const searchParams = new URLSearchParams();
    if (workspaceId) {
      searchParams.set('workspaceId', workspaceId);
    }
    searchParams.set('projectId', projectId);

    return fetcher.load(`${href('/git/changes')}?${searchParams.toString()}`);
  }

  return {
    ...fetcher,
    load,
  };
}
