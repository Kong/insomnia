import { href } from 'react-router';

import { createFetcherSubmitHook } from '~/utils/router';

import type { Route } from './+types/git.fetch';

interface FetchGitData {
  projectId: string;
  workspaceId?: string;
}

export async function clientAction({ request }: Route.ClientActionArgs) {
  console.log('Client action for git fetch', request);
  const data = (await request.json()) as FetchGitData;
  return window.main.git.gitFetchAction(data);
}

export const useGitProjectFetchActionFetcher = createFetcherSubmitHook(
  submit => (data: FetchGitData) => {
    console.log('Submitting git fetch action', data);
    return submit(JSON.stringify(data), {
      method: 'POST',
      action: href('/git/fetch'),
      encType: 'application/json',
    });
  },
  clientAction,
);
