import type { WorkspaceRepository } from 'insomnia-domain';

import { renameWorkspace } from './rename-workspace.use-case';

export class WorkspaceModule {
  constructor(private readonly workspaceRepository: WorkspaceRepository) {}

  renameById(id: string, name: string) {
    return renameWorkspace(this.workspaceRepository, id, name);
  }
}
