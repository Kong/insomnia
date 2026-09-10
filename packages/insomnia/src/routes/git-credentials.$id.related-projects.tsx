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

  // Only return projects that belong to organizations the current user is a member of. This prevents users from seeing projects they don't have access to, which could lead to confusion or errors when trying to delete git credentials.
  const { accountId } = await services.userSession.get();
  let organizations: Organization[] = [];
  try {
    organizations = JSON.parse(localStorage.getItem(`${accountId}:spaces`) || '[]') as Organization[];
  } catch {
    // If parsing fails, fall through with empty array
  }

  // If organizations cannot be loaded, return all related projects unfiltered
  // to avoid silently hiding projects and incorrectly allowing credential deletion.
  if (organizations.length === 0) {
    return {
      projects: relatedProjects,
    };
  }

  const currentUserOrganizationIds = new Set([
    ...organizations.map(o => o.id),
    models.organization.SCRATCHPAD_ORGANIZATION_ID,
    models.organization.getKonnectOrganizationId(accountId),
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
