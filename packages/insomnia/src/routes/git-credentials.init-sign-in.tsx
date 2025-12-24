import { href } from 'react-router';

import type { GitRemoteProviderType } from '~/sync/git/providers';
import { createFetcherSubmitHook } from '~/utils/router';

import type { Route } from './+types/git-credentials.init-sign-in';

interface InitSignInData {
  provider: GitRemoteProviderType;
}

export async function clientAction({ request }: Route.ClientActionArgs) {
  const { provider } = (await request.json()) as InitSignInData;
  return await window.main.git.initSignInToGitProvider({
    provider,
  });
}

export const useInitSignInToGitProviderFetcher = createFetcherSubmitHook(
  submit => (data: InitSignInData) => {
    return submit(JSON.stringify(data), {
      action: href('/git-credentials/init-sign-in'),
      method: 'POST',
      encType: 'application/json',
    });
  },
  clientAction,
);
