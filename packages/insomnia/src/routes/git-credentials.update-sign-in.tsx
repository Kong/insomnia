import { href } from 'react-router';

import type { GitRemoteProviderType } from '~/insomnia-data';
import { createFetcherSubmitHook } from '~/utils/router';

import type { Route } from './+types/git-credentials.update-sign-in';

interface UpdateSignInData {
  provider: GitRemoteProviderType;
  code: string;
  state: string;
}

export async function clientAction({ request }: Route.ClientActionArgs) {
  const { provider, code, state } = (await request.json()) as UpdateSignInData;
  return await window.main.git.updateSignInToGitProvider({
    provider,
    code,
    state,
  });
}

export const useGitProviderUpdateSignInFetcher = createFetcherSubmitHook(
  submit => (data: UpdateSignInData) => {
    return submit(JSON.stringify(data), {
      action: href('/git-credentials/update-sign-in'),
      method: 'POST',
      encType: 'application/json',
    });
  },
  clientAction,
);
