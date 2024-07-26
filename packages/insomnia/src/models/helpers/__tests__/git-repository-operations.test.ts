import { describe, expect, it } from 'vitest';

import * as models from '../../index';
import { createGitRepository } from '../git-repository-operations';

describe('gitRepositoryOperations', () => {
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

});
