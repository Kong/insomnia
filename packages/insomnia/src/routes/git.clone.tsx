import { href, redirect } from 'react-router';

import { invariant } from '~/utils/invariant';
import { createFetcherSubmitHook } from '~/utils/router';

import type { Route } from './+types/git.clone';

interface CloneGitRepoData {
  organizationId: string;
  projectId?: string;
  uri: string;
  author: {
    name: string;
    email: string;
  };
  credentialsId: string | null;
  ref: string;
  selectedAuthorEmail?: string | null;
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

export const useGitCloneActionFetcher = createFetcherSubmitHook(
  submit => (data: CloneGitRepoData) => {
    return submit(JSON.stringify(data), {
      method: 'POST',
      action: href('/git/clone'),
      encType: 'application/json',
    });
  },
  clientAction,
);
