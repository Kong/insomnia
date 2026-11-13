import { href, type ShouldRevalidateFunctionArgs } from 'react-router';

import { createFetcherLoadHook } from '~/ui/utils/router';

import type { Route } from './+types/git.branches';

// The periodic background fetch must not start interactive sign-ins, but this loader lists
// remote branches with interactive authentication, so do not reload it after that fetch.
export function shouldRevalidate({ formAction, json, defaultShouldRevalidate }: ShouldRevalidateFunctionArgs) {
  const isBackgroundFetch =
    formAction === href('/git/fetch') && (json as { background?: boolean } | undefined)?.background === true;
  return isBackgroundFetch ? false : defaultShouldRevalidate;
}

export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  const url = new URL(request.url);
  const params = Object.fromEntries(url.searchParams.entries());

  const workspaceId = params.workspaceId;
  const projectId = params.projectId;
  return window.main.git.getGitBranches({
    projectId,
    workspaceId,
  });
}

export const useGitProjectBranchesLoaderFetcher = createFetcherLoadHook(
  load =>
    ({ projectId, workspaceId }: { workspaceId?: string; projectId: string }) => {
      const searchParams = new URLSearchParams();

      if (workspaceId) {
        searchParams.set('workspaceId', workspaceId);
      }
      searchParams.set('projectId', projectId);
      return load(`${href('/git/branches')}?${searchParams.toString()}`);
    },
  clientLoader,
);
