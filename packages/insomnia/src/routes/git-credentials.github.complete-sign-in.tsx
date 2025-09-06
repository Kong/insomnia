import { href } from 'react-router';

import { createFetcherSubmitHook } from '~/utils/router';

import type { Route } from './+types/git-credentials.github.complete-sign-in';

export async function clientAction({ request }: Route.ClientActionArgs) {
  const { code, state } = (await request.json()) as { code: string; state: string; path: string };
  await window.main.git.completeSignInToGitHub({
    code,
    state,
  });

  return null;
}

export const useGithubCompleteSignInFetcher = createFetcherSubmitHook(
  submit => (data: { code: string; state: string }) => {
    return submit(data, {
      action: href('/git-credentials/github/complete-sign-in'),
      method: 'POST',
      encType: 'application/json',
    });
  },
  clientAction,
);
