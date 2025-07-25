import { href, useFetcher } from 'react-router';

import type { Route } from './+types/git-credentials.gitlab.init-sign-in';

export async function clientAction(_args: Route.ClientActionArgs) {
  await window.main.git.initSignInToGitLab();

  return null;
}

export function useInitSignInToGitLabFetcher() {
  const fetcher = useFetcher<typeof clientAction>();

  function submit() {
    return fetcher.submit({}, { action: href('/git-credentials/gitlab/init-sign-in'), method: 'POST' });
  }

  return {
    ...fetcher,
    submit,
  };
}
