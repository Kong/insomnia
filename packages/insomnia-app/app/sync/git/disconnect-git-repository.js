// @flow

import * as models from '../../models';
import type { GitRepository } from '../../models/git-repository';

type Options = {
  gitRepository: GitRepository,
};

export const disconnectGitRepository = async ({ gitRepository }: Options) => {
  const id = gitRepository._id;
  const workspaceMeta = await models.workspaceMeta.getByGitRepositoryId(id);

  if (workspaceMeta) {
    await models.workspaceMeta.update(workspaceMeta, {
      gitRepositoryId: null,
      cachedGitLastCommitTime: null,
      cachedGitRepositoryBranch: null,
      cachedGitLastAuthor: null,
    });
  }

  await models.gitRepository.remove(gitRepository);
};
