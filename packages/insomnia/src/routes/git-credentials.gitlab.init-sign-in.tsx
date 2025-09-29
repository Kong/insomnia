import { href } from 'react-router';

import { createFetcherSubmitHook } from '~/utils/router';

import type { Route } from './+types/git-credentials.gitlab.init-sign-in';

export async function clientAction(_args: Route.ClientActionArgs) {
  return await window.main.git.initSignInToGitLab();
}

export const useInitSignInToGitLabFetcher = createFetcherSubmitHook(
  submit => () => {
    return submit({}, { action: href('/git-credentials/gitlab/init-sign-in'), method: 'POST' });
  },
  clientAction,
);
