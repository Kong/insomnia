import { href } from 'react-router';

import { gitRepository, project } from '~/models';
import { createFetcherLoadHook } from '~/utils/router';

import type { Route } from './+types/git-credentials.$id.related-projects';

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const { id: gitCredentialsId } = params;

  const relatedGitRepositories = await gitRepository.getAllByCredentialId(gitCredentialsId);

  const gitRepositoryIds = relatedGitRepositories.map(repo => repo._id);

  const relatedProjects = await project.getAllByGitRepositoryIds(gitRepositoryIds);

  return {
    projects: relatedProjects,
  };
}

export const useRelatedProjectsByGitCredentialsIdLoaderFetcher = createFetcherLoadHook(
  load =>
    ({ gitCredentialsId }: { gitCredentialsId: string }) => {
      return load(href('/git-credentials/:id/related-projects', { id: gitCredentialsId }));
    },
  clientLoader,
);
