import { href } from 'react-router';

import { createFetcherLoadHook } from '~/ui/utils/router';

import type { Route } from './+types/git.log';

export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  const url = new URL(request.url);
  const params = Object.fromEntries(url.searchParams.entries());
  const workspaceId = params.workspaceId;
  const projectId = params.projectId;

  return window.main.git.gitLogLoader({ workspaceId, projectId });
}

export const useGitProjectLogLoaderFetcher = createFetcherLoadHook(
  load =>
    ({ workspaceId, projectId }: { workspaceId?: string; projectId: string }) => {
      const searchParams = new URLSearchParams();
      if (workspaceId) {
        searchParams.set('workspaceId', workspaceId);
      }
      searchParams.set('projectId', projectId);
      return load(`${href('/git/log')}?${searchParams.toString()}`);
    },
  clientLoader,
);
