import { useCallback } from 'react';
import { href, useFetcher } from 'react-router';

import type { Route } from './+types/git-credentials.github.init-sign-in';

export async function clientAction(_args: Route.ClientActionArgs) {
  await window.main.git.initSignInToGitHub();

  return null;
}

export function useInitSignInToGitHubFetcher() {
  const { submit: fetcherSubmit, ...fetcherRest } = useFetcher<typeof clientAction>();

  const submit = useCallback(() => {
    return fetcherSubmit({}, { action: href('/git-credentials/github/init-sign-in'), method: 'POST' });
  }, [fetcherSubmit]);

  return {
    ...fetcherRest,
    submit,
  };
}
