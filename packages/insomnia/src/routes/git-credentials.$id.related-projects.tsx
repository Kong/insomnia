import type { Organization } from 'insomnia-api';
import { models, services } from 'insomnia-data';
import { href } from 'react-router';

import { createFetcherLoadHook } from '~/ui/utils/router';

import type { Route } from './+types/git-credentials.$id.related-projects';

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const { id: gitCredentialsId } = params;

  const relatedGitRepositories = await services.gitRepository.getAllByCredentialId(gitCredentialsId);

  const gitRepositoryIds = relatedGitRepositories.map(repo => repo._id);

  const relatedProjects = await services.project.listByGitRepositoryIds(gitRepositoryIds);

  const { accountId } = await services.userSession.get();
  const organizations = JSON.parse(localStorage.getItem(`${accountId}:organizations`) || '[]') as Organization[];
  const currentUserOrganizationIds = new Set([
    ...organizations.map(o => o.id),
    models.organization.SCRATCHPAD_ORGANIZATION_ID,
  ]);

  const currentUserProjects = relatedProjects.filter(p => currentUserOrganizationIds.has(p.parentId));

  return {
    projects: currentUserProjects,
  };
}

export const useRelatedProjectsByGitCredentialsIdLoaderFetcher = createFetcherLoadHook(
  load =>
    ({ gitCredentialsId }: { gitCredentialsId: string }) => {
      return load(href('/git-credentials/:id/related-projects', { id: gitCredentialsId }));
    },
  clientLoader,
);
