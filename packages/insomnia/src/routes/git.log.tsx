import { useCallback } from 'react';
import { href, useFetcher } from 'react-router';

import type { Route } from './+types/git.log';

export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  const url = new URL(request.url);
  const params = Object.fromEntries(url.searchParams.entries());
  const workspaceId = params.workspaceId;
  const projectId = params.projectId;

  return window.main.git.gitLogLoader({ workspaceId, projectId });
}

export function useGitProjectLogLoaderFetcher(args?: Parameters<typeof useFetcher>[0]) {
  const {
    load: fetcherLoad,
    ...fetcherRest
  } = useFetcher<typeof clientLoader>(args);

  const load = useCallback(
    ({ workspaceId, projectId }: { workspaceId?: string; projectId: string }) => {
      const searchParams = new URLSearchParams();
      if (workspaceId) {
        searchParams.set('workspaceId', workspaceId);
      }
      searchParams.set('projectId', projectId);
      return fetcherLoad(`${href('/git/log')}?${searchParams.toString()}`);
    },
    [fetcherLoad]
  );

  return {
    ...fetcherRest,
    load,
  };
}
