import { href } from 'react-router';

import { createFetcherLoadHook } from '~/ui/utils/router';

import type { Route } from './+types/git.validate-credentials';

export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  const url = new URL(request.url);
  const params = Object.fromEntries(url.searchParams.entries());

  return window.main.git.validateGitRepositoryCredentials({
    projectId: params.projectId,
    workspaceId: params.workspaceId || undefined,
  });
}

export const useGitValidateCredentialsFetcher = createFetcherLoadHook(
  load =>
    ({ projectId, workspaceId }: { projectId: string; workspaceId?: string }) => {
      const searchParams = new URLSearchParams({ projectId });
      if (workspaceId) {
        searchParams.set('workspaceId', workspaceId);
      }
      return load(`${href('/git/validate-credentials')}?${searchParams.toString()}`);
    },
  clientLoader,
);
