import { href } from 'react-router';

import { createFetcherSubmitHook } from '~/ui/utils/router';

import type { Route } from './+types/git.push';

interface PushGitData {
  projectId: string;
  workspaceId?: string;
  force?: boolean;
}

export async function clientAction({ request }: Route.ClientActionArgs) {
  const data = (await request.json()) as PushGitData;

  return window.main.git.pushToGitRemote(data);
}

export const useGitProjectPushActionFetcher = createFetcherSubmitHook(
  submit => (data: PushGitData) => {
    return submit(JSON.stringify(data), {
      method: 'POST',
      action: href('/git/push'),
      encType: 'application/json',
    });
  },
  clientAction,
);
