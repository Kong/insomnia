import type { Workspace, WorkspaceRepository } from 'insomnia-domain';

let nextId = 1;

export function createFakeWorkspaceRepository(seed: Workspace[] = []): WorkspaceRepository {
  const store = new Map(seed.map(w => [w._id, w]));
  return {
    async findById(id) {
      return store.get(id) ?? null;
    },
    async findByProjectId(projectId) {
      return [...store.values()].filter(w => w.parentId === projectId);
    },
    async create(input) {
      const workspace = buildWorkspace({ _id: `wrk_${nextId++}`, ...input });
      store.set(workspace._id, workspace);
      return workspace;
    },
    async save(workspace) {
      store.set(workspace._id, workspace);
    },
    async delete(id) {
      store.delete(id);
    },
  };
}

export const buildWorkspace = (overrides: Partial<Workspace> = {}): Workspace => ({
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
