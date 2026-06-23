import { href } from 'react-router';

import { createFetcherSubmitHook } from '~/ui/utils/router';

import type { Route } from './+types/git.init-clone';

interface RepoInitCloneData {
  organizationId: string;
  projectId?: string;
  uri: string;
  credentialsId?: string;
  ref?: string;
}

export async function clientAction({ request }: Route.ClientActionArgs) {
  const data = (await request.json()) as RepoInitCloneData;

  const initCloneResult = await window.main.git.initGitRepoClone(data);

  if ('errors' in initCloneResult) {
    return { errors: initCloneResult.errors };
  }

  return {
    files: initCloneResult.files,
  };
}

export const useGitProjectInitCloneActionFetcher = createFetcherSubmitHook(
  submit => (data: RepoInitCloneData) => {
    return submit(JSON.stringify(data), {
      action: href('/git/init-clone'),
      method: 'POST',
      encType: 'application/json',
    });
  },
  clientAction,
);
