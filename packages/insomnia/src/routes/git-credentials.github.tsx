import { href, useFetcher } from 'react-router';

import { gitCredentials } from '~/models';

import type { Route } from './+types/git-credentials.github';

export async function clientLoader(_args: Route.ClientActionArgs) {
  const credentials = await gitCredentials.getByProvider('github');

  return credentials;
}

export function useGitHubCredentialsFetcher(args?: Parameters<typeof useFetcher>[0]) {
  const fetcher = useFetcher<typeof clientLoader>(args);

  function load() {
    return fetcher.load(href('/git-credentials/github'));
  }

  return {
    ...fetcher,
    load,
  };
}
