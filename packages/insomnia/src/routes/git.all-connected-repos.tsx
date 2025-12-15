import { href } from 'react-router';

import * as models from '~/models';
import { isEmptyGitProject } from '~/models/project';
import { createFetcherLoadHook } from '~/utils/router';

export async function clientLoader() {
  const allProjects = await models.project.all();
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
  load => () => {
    return load(`${href('/git/all-connected-repos')}`);
  },
  clientLoader,
);
