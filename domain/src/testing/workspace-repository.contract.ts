import { beforeEach, describe, expect, it } from 'vitest';

import type { Workspace } from '../workspace/workspace.entity';
import type { WorkspaceRepository } from '../workspace/workspace-repository.port';

export interface WorkspaceRepositoryContractContext {
  repository: WorkspaceRepository;
  /** Seeds a fixture workspace through whatever path the implementation under test provides. */
  createWorkspace: (patch?: Partial<Workspace>) => Promise<Workspace>;
  /** Resets storage to empty between tests. */
  reset: () => Promise<void>;
}

/**
 * Shared contract test suite for any WorkspaceRepository implementation - run this against
 * NedbWorkspaceRepository today, and against SqliteWorkspaceRepository once it exists, so both
 * stay behaviorally identical.
 */
export function runWorkspaceRepositoryContractTests(getContext: () => WorkspaceRepositoryContractContext) {
  describe('WorkspaceRepository contract', () => {
    beforeEach(async () => {
      await getContext().reset();
    });

    it('findById returns null for a missing id', async () => {
      const { repository } = getContext();

      expect(await repository.findById('wrk_does_not_exist')).toBeNull();
    });

    it('findById returns a previously saved workspace', async () => {
      const { repository, createWorkspace } = getContext();
      const workspace = await createWorkspace();

      expect(await repository.findById(workspace._id)).toEqual(workspace);
    });

    it('findByProjectId returns only workspaces under that project', async () => {
      const { repository, createWorkspace } = getContext();
      const projectId = 'proj_contract_test';
      const a = await createWorkspace({ parentId: projectId, name: 'A' });
      const b = await createWorkspace({ parentId: projectId, name: 'B' });
      const other = await createWorkspace({ parentId: 'proj_other', name: 'Other' });

      const found = await repository.findByProjectId(projectId);

      expect(found.map(w => w._id).sort()).toEqual([a._id, b._id].sort());
      expect(found.some(w => w._id === other._id)).toBe(false);
    });

    it('save() persists changes to an existing workspace', async () => {
      const { repository, createWorkspace } = getContext();
      const workspace = await createWorkspace({ name: 'Original' });

      await repository.save({ ...workspace, name: 'Renamed' });

      expect((await repository.findById(workspace._id))?.name).toBe('Renamed');
    });

    it('delete() removes the workspace', async () => {
      const { repository, createWorkspace } = getContext();
      const workspace = await createWorkspace();

      await repository.delete(workspace._id);

      expect(await repository.findById(workspace._id)).toBeNull();
    });
  });
}
