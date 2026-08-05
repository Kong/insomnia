import { database, services } from 'insomnia-data';
import { runWorkspaceRepositoryContractTests } from 'insomnia-domain/testing';

import { nedbWorkspaceRepository } from './nedb-workspace-repository';

runWorkspaceRepositoryContractTests(() => ({
  repository: nedbWorkspaceRepository,
  async createWorkspace(patch) {
    const doc = await services.workspace.create(patch);
    const workspace = await nedbWorkspaceRepository.findById(doc._id);
    if (!workspace) {
      throw new Error(`Failed to seed fixture workspace ${doc._id}`);
    }
    return workspace;
  },
  async reset() {
    await database.init({ inMemoryOnly: true }, true);
  },
}));
