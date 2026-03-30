import type { IconProp } from '@fortawesome/fontawesome-svg-core';
import { href } from 'react-router';

import type { GitRemoteProviderType } from '~/insomnia-data';
import { showToast } from '~/ui/components/toast-notification';
import { createFetcherSubmitHook } from '~/utils/router';

import type { Route } from './+types/git-credentials.update-sign-in';

interface UpdateSignInData {
  provider: GitRemoteProviderType;
  code: string;
  state: string;
}

export async function clientAction({ request }: Route.ClientActionArgs) {
  const { provider, code, state } = (await request.json()) as UpdateSignInData;
  const result = await window.main.git.updateSignInToGitProvider({
    provider,
    code,
    state,
  });

  const icon: IconProp = provider === 'github' ? ['fab', 'github'] : provider === 'gitlab' ? ['fab', 'gitlab'] : 'key';

  if ('errors' in result && result.errors?.length) {
    showToast({
      icon,
      title: 'Connect failed',
      status: 'error',
    });
  } else {
    showToast({
      icon,
      title: 'Successfully connected',
      status: 'success',
    });
  }

  return result;
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
