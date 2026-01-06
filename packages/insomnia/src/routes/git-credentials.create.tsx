import { href } from 'react-router';

import { gitCredentials } from '~/models';
import type { BaseGitCredentialsV2 } from '~/models/git-credentials';
import { createFetcherSubmitHook } from '~/utils/router';

import type { Route } from './+types/git-credentials.create';

export async function clientAction({ request }: Route.ClientActionArgs) {
  const data = (await request.json()) as BaseGitCredentialsV2;

  await gitCredentials.create(data);

  return {
    success: true,
  };
}

export const useGitCredentialsCreateActionFetcher = createFetcherSubmitHook(
  submit => (data: BaseGitCredentialsV2) => {
    return submit(JSON.stringify(data), {
      method: 'POST',
      action: href('/git-credentials/create'),
      encType: 'application/json',
    });
  },
  clientAction,
);
