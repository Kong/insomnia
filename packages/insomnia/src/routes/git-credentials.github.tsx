import { useCallback } from 'react';
import { href, useFetcher } from 'react-router';

import { gitCredentials } from '~/models';

import type { Route } from './+types/git-credentials.github';

export async function clientLoader(_args: Route.ClientActionArgs) {
  const credentials = await gitCredentials.getByProvider('github');

  return credentials;
}

export function useGitHubCredentialsFetcher(args?: Parameters<typeof useFetcher>[0]) {
  const { load: fetcherLoad, ...fetcherRest } = useFetcher<typeof clientLoader>(args);

  const load = useCallback(() => {
    return fetcherLoad(href('/git-credentials/github'));
  }, [fetcherLoad]);

  return {
    ...fetcherRest,
    load,
  };
}
