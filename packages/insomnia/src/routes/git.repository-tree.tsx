import { href } from 'react-router';

import { createFetcherLoadHook } from '~/utils/router';

import type { Route } from './+types/git.repository-tree';

export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  const url = new URL(request.url);
  const params = Object.fromEntries(url.searchParams.entries());

  const projectId = params.projectId;
  return window.main.git.getRepositoryDirectoryTree({ projectId });
}

export const useGitProjectRepositoryTreeLoaderFetcher = createFetcherLoadHook(
  load =>
    ({ projectId }: { projectId: string }) => {
      const searchParams = new URLSearchParams();

      searchParams.set('projectId', projectId);

      return load(`${href('/git/repository-tree')}?${searchParams.toString()}`);
    },
  clientLoader,
);
