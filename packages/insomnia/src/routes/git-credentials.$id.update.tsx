import { href } from 'react-router';

import { gitCredentials } from '~/models';
import { type GitCredentialsV2, isGitCredentialsV2 } from '~/models/git-credentials';
import { createFetcherSubmitHook } from '~/utils/router';

import type { Route } from './+types/git-credentials.$id.update';

export async function clientAction({ request, params }: Route.ClientActionArgs) {
  const data = (await request.json()) as Partial<GitCredentialsV2>;
  const { id } = params;

  const credential = await gitCredentials.getById(id);
  if (!credential) {
    throw new Error('Credential not found');
  }
  if (!isGitCredentialsV2(credential)) {
    throw new Error('Invalid credential data structure');
  }

  await gitCredentials.update(credential, data);

  return {
    success: true,
  };
}

export const useGitCredentialsUpdateActionFetcher = createFetcherSubmitHook(
  submit => (id: string, data: Partial<GitCredentialsV2>) => {
    return submit(JSON.stringify(data), {
      method: 'POST',
      action: href('/git-credentials/:id/update', { id }),
      encType: 'application/json',
    });
  },
  clientAction,
);
