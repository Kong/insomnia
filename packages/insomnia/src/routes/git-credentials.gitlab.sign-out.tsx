import { useCallback } from 'react';
import { href, useFetcher } from 'react-router';

import type { Route } from './+types/git-credentials.gitlab.sign-out';

export async function clientAction(_args: Route.ClientActionArgs) {
  await window.main.git.signOutOfGitLab();

  return null;
}

export function useGitLabSignOutFetcher(args?: Parameters<typeof useFetcher>[0]) {
  const { submit: fetcherSubmit, ...fetcherRest } = useFetcher<typeof clientAction>(args);

  const submit = useCallback(() => {
    return fetcherSubmit({}, { action: href('/git-credentials/gitlab/sign-out'), method: 'POST' });
  }, [fetcherSubmit]);

  return {
    ...fetcherRest,
    submit,
  };
}
