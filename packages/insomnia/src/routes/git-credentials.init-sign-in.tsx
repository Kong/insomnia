import { href } from 'react-router';

import type { GitRemoteProviderType } from '~/sync/git/providers/types';
import { createFetcherSubmitHook } from '~/ui/utils/router';

import type { Route } from './+types/git-credentials.init-sign-in';

interface InitSignInData {
  provider: GitRemoteProviderType;
  /** When reauthorizing an existing credential, its ID — so completion updates that exact credential instead of creating a new one. */
  credentialId?: string;
}

export async function clientAction({ request }: Route.ClientActionArgs) {
  const { provider, credentialId } = (await request.json()) as InitSignInData;
  return await window.main.git.initSignInToGitProvider({
    provider,
    credentialId,
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
