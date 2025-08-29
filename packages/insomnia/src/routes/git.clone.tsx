import { useCallback } from 'react';
import { href, redirect, useFetcher } from 'react-router';

import type { GitCredentials } from '~/models/git-repository';
import { invariant } from '~/utils/invariant';

import type { Route } from './+types/git.clone';

interface CloneGitRepoData {
  organizationId: string;
  projectId?: string;
  uri: string;
  author: {
    name: string;
    email: string;
  };
  credentials: GitCredentials;
}

export async function clientAction({ request }: Route.ClientActionArgs) {
  const data = (await request.json()) as CloneGitRepoData;

  const { errors, projectId } = await window.main.git.cloneGitRepo(data);

  if (errors) {
    return { errors };
  }

  invariant(projectId, 'Project ID is required');

  return redirect(
    href(`/organization/:organizationId/project/:projectId`, {
      organizationId: data.organizationId,
      projectId,
    }),
  );
}

export function useGitCloneActionFetcher(args?: Parameters<typeof useFetcher>[0]) {
  const {
    submit: fetcherSubmit,
    ...fetcherRest
  } = useFetcher<typeof clientAction>(args);

  const submit = useCallback((data: CloneGitRepoData) => {
    return fetcherSubmit(JSON.stringify(data), {
      method: 'POST',
      action: href('/git/clone'),
      encType: 'application/json',
    });
  }, [fetcherSubmit]);

  return {
    ...fetcherRest,
    submit,
  };
}
