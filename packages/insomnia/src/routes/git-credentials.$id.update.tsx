import type { GitCredentialsV2 } from 'insomnia-data';
import { models, services } from 'insomnia-data';
import { href } from 'react-router';

import { createFetcherSubmitHook } from '~/ui/utils/router';

import type { Route } from './+types/git-credentials.$id.update';

const { isGitCredentialsV2 } = models.gitCredentials;

export async function clientAction({ request, params }: Route.ClientActionArgs) {
  const data = (await request.json()) as Partial<GitCredentialsV2>;
  const { id } = params;

  const credential = await services.gitCredentials.getById(id);
  if (!credential) {
    throw new Error('Credential not found');
  }
  if (!isGitCredentialsV2(credential)) {
    throw new Error('Invalid credential data structure');
  }

  await services.gitCredentials.update(credential, data);

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
