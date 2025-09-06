import { href } from 'react-router';

import { createFetcherSubmitHook } from '~/utils/router';

import type { Route } from './+types/git-credentials.github.init-sign-in';

export async function clientAction(_args: Route.ClientActionArgs) {
  await window.main.git.initSignInToGitHub();

  return null;
}

export const useInitSignInToGitHubFetcher = createFetcherSubmitHook(
  submit => () => {
    return submit({}, { action: href('/git-credentials/github/init-sign-in'), method: 'POST' });
  },
  clientAction,
);
