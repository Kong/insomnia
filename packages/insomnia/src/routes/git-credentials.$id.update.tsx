import { href } from 'react-router';

import { gitCredentials } from '~/models';
import type { GitCredentials } from '~/models/git-credentials';
import { createFetcherSubmitHook } from '~/utils/router';

import type { Route } from './+types/git-credentials.$id.update';

export async function clientAction({ request, params }: Route.ClientActionArgs) {
  const data = (await request.json()) as Partial<GitCredentials>;
  const { id } = params;

  const credential = await gitCredentials.getById(id);
  if (!credential) {
    throw new Error('Credential not found');
  }

  await gitCredentials.update(credential, data);

  return {
    success: true,
  };
}

export const useGitCredentialsUpdateActionFetcher = createFetcherSubmitHook(
  submit => (id: string, data: Partial<GitCredentials>) => {
    return submit(JSON.stringify(data), {
      method: 'POST',
      action: href('/git-credentials/:id/update', { id }),
      encType: 'application/json',
    });
  },
  clientAction,
);
