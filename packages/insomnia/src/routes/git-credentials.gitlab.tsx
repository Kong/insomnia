import { href, useFetcher } from 'react-router';

import { gitCredentials } from '~/models';

import type { Route } from './+types/git-credentials.gitlab';

export async function clientLoader(_args: Route.ClientActionArgs) {
  const credentials = await gitCredentials.getByProvider('gitlab');

  return credentials;
}

export function useGitLabCredentialsFetcher(args?: Parameters<typeof useFetcher>[0]) {
  const fetcher = useFetcher<typeof clientLoader>(args);

  function load() {
    return fetcher.load(href('/git-credentials/gitlab'));
  }

  return {
    ...fetcher,
    load,
  };
}
