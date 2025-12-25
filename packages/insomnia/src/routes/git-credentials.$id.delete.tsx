import { href } from 'react-router';

import { gitCredentials, gitRepository } from '~/models';
import { invariant } from '~/utils/invariant';
import { createFetcherSubmitHook } from '~/utils/router';

import type { Route } from './+types/git-credentials.$id.delete';

export async function clientAction({ params }: Route.ClientActionArgs) {
  const { id } = params;
  console.log('ACTION:Deleting git credential', id);
  const credential = await gitCredentials.getById(id);
  invariant(credential, 'Git credential not found');

  const connectedRepositories = await gitRepository.getAllByCredentialId(id);

  for (const repo of connectedRepositories) {
    await gitRepository.update(repo, { credentialsId: null });
  }

  await gitCredentials.remove(credential);
}

export const useGitCredentialsDeleteActionFetcher = createFetcherSubmitHook(
  submit =>
    ({ id }: { id: string }) => {
      return submit(
        {},
        {
          method: 'POST',
          action: `${href('/git-credentials/:id/delete', { id })}`,
        },
      );
    },
  clientAction,
);
