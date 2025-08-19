import { useCallback } from 'react';
import { href, useFetcher } from 'react-router';

import type { Route } from './+types/git.repository-tree';

export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  const url = new URL(request.url);
  const params = Object.fromEntries(url.searchParams.entries());

  const projectId = params.projectId;
  return window.main.git.getRepositoryDirectoryTree({ projectId });
}

export function useGitProjectRepositoryTreeLoaderFetcher(args?: Parameters<typeof useFetcher>[0]) {
  const { load: fetcherLoad, ...fetcherRest } = useFetcher<typeof clientLoader>(args);

  const load = useCallback(
    ({ projectId }: { projectId: string }) => {
      const searchParams = new URLSearchParams();

      searchParams.set('projectId', projectId);

      return fetcherLoad(`${href('/git/repository-tree')}?${searchParams.toString()}`);
    },
    [fetcherLoad],
  );

  return {
    ...fetcherRest,
    load,
  };
}
