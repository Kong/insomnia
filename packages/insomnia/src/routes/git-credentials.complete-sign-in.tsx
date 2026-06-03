import type { IconProp } from '@fortawesome/fontawesome-svg-core';
import type { GitRemoteProviderType } from 'insomnia-data';
import { href } from 'react-router';

import { showToast } from '~/ui/components/toast-notification';
import { createFetcherSubmitHook } from '~/utils/router';

import type { Route } from './+types/git-credentials.complete-sign-in';

interface CompleteSignInData {
  provider: GitRemoteProviderType;
  code: string;
  state: string;
  isEditing?: boolean;
}

export async function clientAction({ request }: Route.ClientActionArgs) {
  const { provider, code, state, isEditing } = (await request.json()) as CompleteSignInData;
  const result = await window.main.git.completeSignInToGitProvider({
    provider,
    code,
    state,
    isEditing,
  });
  const providerIcon = provider === 'github' ? ['fab', 'github'] : provider === 'gitlab' ? ['fab', 'gitlab'] : 'key';

  if ('errors' in result && result.errors?.length) {
    showToast({
      icon: providerIcon as IconProp,
      title: 'Connect failed',
      status: 'error',
    });
  } else {
    showToast({
      icon: providerIcon as IconProp,
      title: 'Successfully connected',
      status: 'success',
    });
  }

  return result;
}

export const GIT_PROVIDER_COMPLETE_SIGN_IN_FETCHER_KEY = 'git-provider-complete-sign-in';

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
