import type { Workspace as DataWorkspace } from 'insomnia-data';
import { services } from 'insomnia-data';
import type { Workspace, WorkspaceRepository } from 'insomnia-domain';

const toDomainWorkspace = (doc: DataWorkspace): Workspace => ({
  _id: doc._id,
  type: 'Workspace',
  parentId: doc.parentId,
  created: doc.created,
  modified: doc.modified,
  isPrivate: doc.isPrivate,
  name: doc.name,
  description: doc.description,
  scope: doc.scope,
  konnectServiceId: doc.konnectServiceId,
});

// Thin adapter over insomnia-data's existing services.workspace/database calls - no
// reimplementation. Behavior (including workspace.remove()'s cascade-delete of
// descendants) is unchanged; this only introduces the port boundary.
export const nedbWorkspaceRepository: WorkspaceRepository = {
  async findById(id) {
    const doc = await services.workspace.getById(id);
    return doc ? toDomainWorkspace(doc) : null;
  },

  async findByProjectId(projectId) {
    const docs = await services.workspace.listByParentId(projectId);
    return docs.map(toDomainWorkspace);
  },

  async save(workspace) {
    await services.workspace.upsert(workspace as unknown as DataWorkspace);
  },

  async delete(id) {
    await services.workspace.remove(id);
  },
};
