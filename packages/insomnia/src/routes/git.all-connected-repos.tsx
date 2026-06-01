import type { Organization } from 'insomnia-api';
import type { Project } from 'insomnia-data';
import { models, services } from 'insomnia-data';
import { href } from 'react-router';

import { database } from '~/common/database';
import { createFetcherLoadHook } from '~/utils/router';

export async function clientLoader() {
  const { accountId } = await services.userSession.get();
  const organizations = JSON.parse(localStorage.getItem(`${accountId}:organizations`) || '[]') as Organization[];
  const allProjects = (
    await Promise.all(
      organizations.map(organization =>
        database.find<Project>(models.project.type, {
          parentId: organization.id,
        }),
      ),
    )
  ).flat();

  const organizationMap = Object.fromEntries(organizations.map(o => [o.id, o]));

  const allConnectedGitProjects = allProjects.filter(project => models.project.isConnectedGitProject(project));
  const gitRepoURIInfoMap: Record<string, { organizationName: string; projectName: string }> = {};
  await Promise.all(
    allConnectedGitProjects.map(async project => {
      const gitRepositoryId = models.project.isGitProject(project) ? models.project.getEffectiveRepoId(project) : null;
      if (gitRepositoryId) {
        const gitRepository = await services.gitRepository.getById(gitRepositoryId);
        if (gitRepository) {
          gitRepoURIInfoMap[gitRepository.uri] = {
            organizationName: organizationMap[project.parentId]?.name || '',
            projectName: project.name,
          };
        }
      }
    }),
  );
  return gitRepoURIInfoMap;
}

export const useAllConnectedReposLoaderFetcher = createFetcherLoadHook(
  load => () => {
    return load(`${href('/git/all-connected-repos')}`);
  },
  clientLoader,
);
