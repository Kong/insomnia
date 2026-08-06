import type { Workspace, WorkspaceRepository } from 'insomnia-domain';
import { describe, expect, it } from 'vitest';

import { Insomnia } from './insomnia';

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

describe('Insomnia', () => {
  it('workspace.renameById() delegates to the injected WorkspaceRepository', async () => {
    const workspace = buildWorkspace();
    const workspaceRepository = createFakeWorkspaceRepository([workspace]);
    const insomnia = new Insomnia({ workspaceRepository });

    const renamed = await insomnia.workspace.renameById(workspace._id, 'Renamed');

    expect(renamed.name).toBe('Renamed');
    expect((await workspaceRepository.findById(workspace._id))?.name).toBe('Renamed');
  });
});
