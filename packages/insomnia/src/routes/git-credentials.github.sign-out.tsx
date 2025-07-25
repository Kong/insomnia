import { href, useFetcher } from 'react-router';

import type { Route } from './+types/git-credentials.github.sign-out';

export async function clientAction(_args: Route.ClientActionArgs) {
  await window.main.git.signOutOfGitHub();

  return null;
}

export function useGithubSignOutFetcher() {
  const fetcher = useFetcher<typeof clientAction>();

  function submit() {
    return fetcher.submit({}, { action: href('/git-credentials/github/sign-out'), method: 'POST' });
  }

  return {
    ...fetcher,
    submit,
  };
}
