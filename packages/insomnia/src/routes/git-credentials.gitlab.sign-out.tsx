import { href } from 'react-router';

import { createFetcherSubmitHook } from '~/utils/router';

import type { Route } from './+types/git-credentials.gitlab.sign-out';

export async function clientAction(_args: Route.ClientActionArgs) {
  await window.main.git.signOutOfGitLab();

  return null;
}

export const useGitLabSignOutFetcher = createFetcherSubmitHook(
  submit => () => {
    return submit({}, { action: href('/git-credentials/gitlab/sign-out'), method: 'POST' });
  },
  clientAction,
);
