import { href } from 'react-router';

import { gitCredentials } from '~/models';
import type { GitCredentials } from '~/models/git-credentials';
import { createFetcherSubmitHook } from '~/utils/router';

import type { Route } from './+types/git-credentials.create';

export async function clientAction({ request }: Route.ClientActionArgs) {
  const data = (await request.json()) as Partial<GitCredentials>;

  await gitCredentials.create(data);

  return {
    success: true,
  };
}

export const useGitCredentialsCreateActionFetcher = createFetcherSubmitHook(
  submit => (data: Partial<GitCredentials>) => {
    return submit(JSON.stringify(data), {
      method: 'POST',
      action: href('/git-credentials/create'),
      encType: 'application/json',
    });
  },
  clientAction,
);
