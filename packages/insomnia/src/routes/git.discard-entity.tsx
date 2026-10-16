import { href } from 'react-router';

import { createFetcherSubmitHook } from '~/ui/utils/router';

import type { Route } from './+types/git.discard-entity';

interface DiscardPartialGitChangeData {
  filepath: string;
  content: string;
  projectId: string;
  workspaceId?: string;
}

export async function clientAction({ request }: Route.ClientActionArgs) {
  const data = (await request.json()) as DiscardPartialGitChangeData;
  return window.main.git.discardPartialContent(data);
}

export const useGitProjectDiscardPartialContentActionFetcher = createFetcherSubmitHook(
  submit => (data: DiscardPartialGitChangeData) => {
    return submit(JSON.stringify(data), {
      method: 'POST',
      action: href('/git/discard-entity'),
      encType: 'application/json',
    });
  },
  clientAction,
);
