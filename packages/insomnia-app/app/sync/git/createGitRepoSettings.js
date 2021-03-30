// @flow

import type { GitRepository } from '../../models/git-repository';
import * as models from '../../models';

export const createGitRepoSettings = async (workspaceId: string, gitRepo: GitRepository) => {
  const newRepo = await models.gitRepository.create(gitRepo);
  const meta = await models.workspaceMeta.getOrCreateByParentId(workspaceId);
  await models.workspaceMeta.update(meta, { gitRepositoryId: newRepo._id });
};
