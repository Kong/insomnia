import { href } from 'react-router';

import { database } from '~/insomnia-data';
import * as models from '~/models';
import { isEmptyGitProject, type Project } from '~/models/project';
import { createFetcherLoadHook } from '~/utils/router';

import type { Route } from './+types/organization.$organizationId.git.all-connected-repos';

export async function clientLoader({ params }: Route.ClientActionArgs) {
  const { organizationId } = params;
  const allProjects = await database.find<Project>('Project', {
    parentId: organizationId,
  });
  const allConnectedGitProjects = allProjects.filter(
    project => models.project.isGitProject(project) && !isEmptyGitProject(project),
  );
  const gitRepoURIProjectNameMap: Record<string, string> = {};
  await Promise.all(
    allConnectedGitProjects.map(async ({ gitRepositoryId, name }) => {
      if (gitRepositoryId) {
        const gitRepository = await models.gitRepository.getById(gitRepositoryId);
        if (gitRepository) {
          gitRepoURIProjectNameMap[gitRepository.uri] = name;
        }
      }
    }),
  );
  return gitRepoURIProjectNameMap;
}

export const useAllConnectedReposLoaderFetcher = createFetcherLoadHook(
  load => (organizationId: string) => {
    return load(`${href('/organization/:organizationId/git/all-connected-repos', { organizationId })}`);
  },
  clientLoader,
);
