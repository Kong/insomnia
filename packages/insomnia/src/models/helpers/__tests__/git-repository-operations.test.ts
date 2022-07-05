import { beforeEach, describe, expect, it } from '@jest/globals';

import { globalBeforeEach } from '../../../__jest__/before-each';
import * as models from '../../index';
import { createGitRepository, deleteGitRepository } from '../git-repository-operations';

describe('gitRepositoryOperations', () => {
  beforeEach(globalBeforeEach);
  describe('createGitRepository', () => {
    it('should create and link to workspace meta', async () => {
      const repoId = 'git_1';
      const workspaceId = 'wrk_1';
      await createGitRepository(workspaceId, {
        _id: repoId,
      });
      const wMetas = await models.workspaceMeta.all();
      expect(wMetas).toHaveLength(1);
      const wMeta = wMetas[0];
      expect(wMeta.parentId).toBe(workspaceId);
      expect(wMeta.gitRepositoryId).toBe(repoId);
    });
  });

  describe('deleteGitRepository', () => {
    it('should delete', async () => {
      const repo = await models.gitRepository.create();
      expect(await models.gitRepository.all()).toHaveLength(1);
      await deleteGitRepository(repo);
      expect(await models.gitRepository.all()).toHaveLength(0);
    });

    it('should reset workspace meta fields', async () => {
      const repo = await models.gitRepository.create();
      const wrk = await models.workspace.create();
      await models.workspaceMeta.create({
        parentId: wrk._id,
        gitRepositoryId: repo._id,
        cachedGitRepositoryBranch: 'abc',
        cachedGitLastCommitTime: 123,
        cachedGitLastAuthor: 'abc',
      });
      await deleteGitRepository(repo);
      expect(await models.gitRepository.all()).toHaveLength(0);
      const meta = await models.workspaceMeta.getByParentId(wrk._id);
      expect(meta).toStrictEqual(
        expect.objectContaining({
          gitRepositoryId: null,
          cachedGitLastCommitTime: null,
          cachedGitRepositoryBranch: null,
          cachedGitLastAuthor: null,
        }),
      );
    });
  });
});
