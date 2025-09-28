import { href } from 'react-router';

import { createFetcherLoadHook } from '~/utils/router';

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

export const useGitProjectChangesFetcher = createFetcherLoadHook(
  load =>
    ({ projectId, workspaceId }: { projectId: string; workspaceId?: string }) => {
      const searchParams = new URLSearchParams();
      if (workspaceId) {
        searchParams.set('workspaceId', workspaceId);
      }
      searchParams.set('projectId', projectId);

      return load(`${href('/git/changes')}?${searchParams.toString()}`);
    },
  clientLoader,
);
