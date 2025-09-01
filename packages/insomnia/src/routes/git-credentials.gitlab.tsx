import { href } from 'react-router';

import { gitCredentials } from '~/models';
import { createFetcherLoadHook } from '~/utils/router';

import type { Route } from './+types/git-credentials.gitlab';

export async function clientLoader(_args: Route.ClientActionArgs) {
  const credentials = await gitCredentials.getByProvider('gitlab');

  return credentials;
}

export const useGitLabCredentialsFetcher = createFetcherLoadHook(
  load => () => {
    return load(href('/git-credentials/gitlab'));
  },
  clientLoader,
);
