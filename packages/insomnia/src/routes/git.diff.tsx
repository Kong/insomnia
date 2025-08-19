import { useCallback } from 'react';
import { href, useFetcher } from 'react-router';

import { invariant } from '~/utils/invariant';

import type { Route } from './+types/git.diff';

export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  const url = new URL(request.url);

  const filepath = url.searchParams.get('filepath');
  invariant(filepath, 'Filepath is required');

  const staged = url.searchParams.get('staged') === 'true';
  const projectId = url.searchParams.get('projectId');
  invariant(projectId, 'Project ID is required');
  const workspaceId = url.searchParams.get('workspaceId') || undefined;

  return window.main.git.diffFileLoader({ filepath, staged, projectId, workspaceId });
}

export function useGitProjectDiffLoaderFetcher(args?: Parameters<typeof useFetcher>[0]) {
  const {
    load: fetcherLoad,
    ...fetcherRest
  } = useFetcher<typeof clientLoader>(args);

  const load = useCallback((
    {
      workspaceId,
      projectId,
      filePath,
      staged,
    }: {
      workspaceId?: string;
      projectId: string;
      filePath: string;
      staged: boolean;
    }
  ) => {
    const params = new URLSearchParams();
    params.set('filepath', filePath);
    params.set('staged', staged ? 'true' : 'false');
    if (workspaceId) {
      params.set('workspaceId', workspaceId);
    }
    params.set('projectId', projectId);

    return fetcherLoad(`${href('/git/diff')}?${params.toString()}`);
  }, [fetcherLoad]);

  return {
    ...fetcherRest,
    load,
  };
}
