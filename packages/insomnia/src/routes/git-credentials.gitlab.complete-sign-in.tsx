import { href, useFetcher } from 'react-router';

import type { Route } from './+types/git-credentials.gitlab.complete-sign-in';

export async function clientAction({ request }: Route.ClientActionArgs) {
  const { code, state } = (await request.json()) as { code: string; state: string; path: string };
  await window.main.git.completeSignInToGitLab({
    code,
    state,
  });

  return null;
}

export function useGitLabCompleteSignInFetcher(args?: Parameters<typeof useFetcher>[0]) {
  const fetcher = useFetcher<typeof clientAction>(args);

  function submit(data: { code: string; state: string }) {
    return fetcher.submit(data, { action: href('/git-credentials/gitlab/complete-sign-in'), method: 'POST' });
  }

  return {
    ...fetcher,
    submit,
  };
}
