import type { Workspace, WorkspaceRepository } from 'insomnia-domain';
import { describe, expect, it } from 'vitest';

import { renameWorkspace } from './rename-workspace.use-case';

function createFakeWorkspaceRepository(seed: Workspace[] = []): WorkspaceRepository {
  const store = new Map(seed.map(w => [w._id, w]));
  return {
    async findById(id) {
      return store.get(id) ?? null;
    },
    async findByProjectId(projectId) {
      return [...store.values()].filter(w => w.parentId === projectId);
    },
    async save(workspace) {
      store.set(workspace._id, workspace);
    },
    async delete(id) {
      store.delete(id);
    },
  };
}

const buildWorkspace = (overrides: Partial<Workspace> = {}): Workspace => ({
  _id: 'wrk_1',
  type: 'Workspace',
  parentId: 'proj_1',
  created: 0,
  modified: 0,
  isPrivate: false,
  name: 'Original',
  description: '',
  scope: 'collection',
  ...overrides,
});

describe('renameWorkspace', () => {
  it('renames an existing workspace', async () => {
    const workspace = buildWorkspace();
    const repository = createFakeWorkspaceRepository([workspace]);

    const renamed = await renameWorkspace(repository, workspace._id, 'Renamed');

    expect(renamed.name).toBe('Renamed');
    expect((await repository.findById(workspace._id))?.name).toBe('Renamed');
  });

  it('throws when the workspace does not exist', async () => {
    const repository = createFakeWorkspaceRepository([]);

    await expect(renameWorkspace(repository, 'wrk_missing', 'Renamed')).rejects.toThrow('Workspace not found');
  });
});
