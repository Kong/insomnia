import { useCallback } from 'react';
import { href, useFetcher } from 'react-router';

import type { GitCredentials } from '~/models/git-repository';

import type { Route } from './+types/git.init-clone';

interface RepoInitCloneData {
  organizationId: string;
  projectId?: string;
  uri: string;
  authorName: string;
  authorEmail: string;
  credentials: Required<GitCredentials>;
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

export function useGitProjectInitCloneActionFetcher(args?: Parameters<typeof useFetcher>[0]) {
  const {
    submit: fetcherSubmit,
    ...fetcherRest
  } = useFetcher<typeof clientAction>(args);

  const submit = useCallback((data: RepoInitCloneData) => {
    return fetcherSubmit(JSON.stringify(data), {
      action: href('/git/init-clone'),
      method: 'POST',
      encType: 'application/json',
    });
  }, [fetcherSubmit]);

  return {
    ...fetcherRest,
    submit,
  };
}
