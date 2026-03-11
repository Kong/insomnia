import type { Organization } from 'insomnia-api';
import { href } from 'react-router';

import { database } from '~/common/database';
import * as models from '~/models';
import { userSession } from '~/models';
import type { Project } from '~/models/project';
import { isEmptyGitProject } from '~/models/project';
import { createFetcherLoadHook } from '~/utils/router';

export async function clientLoader() {
  const { accountId } = await userSession.getOrCreate();
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

  const allConnectedGitProjects = allProjects.filter(
    project => models.project.isGitProject(project) && !isEmptyGitProject(project),
  );
  const gitRepoURIInfoMap: Record<string, { organizationName: string; projectName: string }> = {};
  await Promise.all(
    allConnectedGitProjects.map(async ({ gitRepositoryId, name, parentId }) => {
      if (gitRepositoryId) {
        const gitRepository = await models.gitRepository.getById(gitRepositoryId);
        if (gitRepository) {
          const organization = organizations.find(o => o.id === parentId);
          gitRepoURIInfoMap[gitRepository.uri] = {
            organizationName: organization?.name || '',
            projectName: name,
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
