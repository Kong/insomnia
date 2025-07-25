import { href, useFetcher } from 'react-router';

import type { Route } from './+types/git-credentials.github.init-sign-in';

export async function clientAction(_args: Route.ClientActionArgs) {
  await window.main.git.initSignInToGitHub();

  return null;
}

export function useInitSignInToGitHubFetcher() {
  const fetcher = useFetcher<typeof clientAction>();

  function submit() {
    return fetcher.submit({}, { action: href('/git-credentials/github/init-sign-in'), method: 'POST' });
  }

  return {
    ...fetcher,
    submit,
  };
}
