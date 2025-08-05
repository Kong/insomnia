import { useCallback } from 'react';
import { href, useFetcher } from 'react-router';

import type { Route } from './+types/git-credentials.github.complete-sign-in';

export async function clientAction({ request }: Route.ClientActionArgs) {
  const { code, state } = (await request.json()) as { code: string; state: string; path: string };
  await window.main.git.completeSignInToGitHub({
    code,
    state,
  });

  return null;
}

export function useGithubCompleteSignInFetcher(args?: Parameters<typeof useFetcher>[0]) {
  const { submit: fetcherSubmit, ...fetcherRest } = useFetcher<typeof clientAction>(args);

  const submit = useCallback(
    (data: { code: string; state: string }) => {
      return fetcherSubmit(data, { action: href('/git-credentials/github/complete-sign-in'), method: 'POST' });
    },
    [fetcherSubmit],
  );

  return {
    ...fetcherRest,
    submit,
  };
}
