import { href } from 'react-router';

import { createFetcherSubmitHook } from '~/utils/router';

import type { Route } from './+types/git-credentials.gitlab.complete-sign-in';

export async function clientAction({ request }: Route.ClientActionArgs) {
  const { code, state } = (await request.json()) as { code: string; state: string; path: string };

  return await window.main.git.completeSignInToGitLab({
    code,
    state,
  });
}

export const useGitLabCompleteSignInFetcher = createFetcherSubmitHook(
  submit => (data: { code: string; state: string }) => {
    return submit(data, {
      action: href('/git-credentials/gitlab/complete-sign-in'),
      method: 'POST',
      encType: 'application/json',
    });
  },
  clientAction,
);
