import { href } from 'react-router';

import { createFetcherSubmitHook } from '~/utils/router';

import type { Route } from './+types/git-credentials.github.sign-out';

export async function clientAction(_args: Route.ClientActionArgs) {
  await window.main.git.signOutOfGitHub();

  return null;
}

export const useGithubSignOutFetcher = createFetcherSubmitHook(
  submit => () => {
    return submit({}, { action: href('/git-credentials/github/sign-out'), method: 'POST' });
  },
  clientAction,
);
