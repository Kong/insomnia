import { href } from 'react-router';

import { invariant } from '~/common/utils/invariant';
import { createFetcherLoadHook } from '~/ui/utils/router';

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

export const useGitProjectDiffLoaderFetcher = createFetcherLoadHook(
  load =>
    ({
      workspaceId,
      projectId,
      filePath,
      staged,
    }: {
      workspaceId?: string;
      projectId: string;
      filePath: string;
      staged: boolean;
    }) => {
      const params = new URLSearchParams();
      params.set('filepath', filePath);
      params.set('staged', staged ? 'true' : 'false');
      if (workspaceId) {
        params.set('workspaceId', workspaceId);
      }
      params.set('projectId', projectId);

      return load(`${href('/git/diff')}?${params.toString()}`);
    },
  clientLoader,
);
