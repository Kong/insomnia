import { href } from 'react-router';

import { createFetcherSubmitHook } from '~/ui/utils/router';

import type { Route } from './+types/git.discard';

interface DiscardGitChangesData {
  paths: string[];
  projectId: string;
  workspaceId?: string;
}

export async function clientAction({ request }: Route.ClientActionArgs) {
  const data = (await request.json()) as DiscardGitChangesData;

  return window.main.git.discardChanges(data);
}

export const useGitProjectDiscardActionFetcher = createFetcherSubmitHook(
  submit => (data: DiscardGitChangesData) => {
    return submit(JSON.stringify(data), {
      method: 'POST',
      action: href('/git/discard'),
      encType: 'application/json',
    });
  },
  clientAction,
);
