import { href } from 'react-router';

import type { GitRemoteProviderType } from '~/models/git-credentials';
import { createFetcherSubmitHook } from '~/utils/router';

import type { Route } from './+types/git-credentials.complete-sign-in';

interface CompleteSignInData {
  provider: GitRemoteProviderType;
  code: string;
  state: string;
}

export async function clientAction({ request }: Route.ClientActionArgs) {
  const { provider, code, state } = (await request.json()) as CompleteSignInData;
  return await window.main.git.completeSignInToGitProvider({
    provider,
    code,
    state,
  });
}

export const useGitProviderCompleteSignInFetcher = createFetcherSubmitHook(
  submit => (data: CompleteSignInData) => {
    return submit(JSON.stringify(data), {
      action: href('/git-credentials/complete-sign-in'),
      method: 'POST',
      encType: 'application/json',
    });
  },
  clientAction,
);
