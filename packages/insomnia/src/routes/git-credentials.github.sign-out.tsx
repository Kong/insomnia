import { useCallback } from 'react';
import { href, useFetcher } from 'react-router';

import type { Route } from './+types/git-credentials.github.sign-out';

export async function clientAction(_args: Route.ClientActionArgs) {
  await window.main.git.signOutOfGitHub();

  return null;
}

export function useGithubSignOutFetcher() {
  const { submit: fetcherSubmit, ...fetcherRest } = useFetcher<typeof clientAction>();

  const submit = useCallback(() => {
    return fetcherSubmit({}, { action: href('/git-credentials/github/sign-out'), method: 'POST' });
  }, [fetcherSubmit]);

  return {
    ...fetcherRest,
    submit,
  };
}
