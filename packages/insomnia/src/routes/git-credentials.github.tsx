import { href } from 'react-router';

import { gitCredentials } from '~/models';
import { createFetcherLoadHook } from '~/utils/router';

import type { Route } from './+types/git-credentials.github';

export async function clientLoader(_args: Route.ClientActionArgs) {
  const credentials = await gitCredentials.getByProvider('github');

  return {
    credentials,
  };
}

export const useGitHubCredentialsFetcher = createFetcherLoadHook(
  load => () => {
    return load(href('/git-credentials/github'));
  },
  clientLoader,
);
