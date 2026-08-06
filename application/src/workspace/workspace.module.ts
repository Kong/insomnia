import type { CreateWorkspaceInput, WorkspaceRepository } from 'insomnia-domain';

import { createWorkspace } from './create-workspace.use-case';
import { deleteWorkspace } from './delete-workspace.use-case';
import { moveWorkspace } from './move-workspace.use-case';
import { renameWorkspace } from './rename-workspace.use-case';

export class WorkspaceModule {
  constructor(private readonly workspaceRepository: WorkspaceRepository) {}

  create(input: CreateWorkspaceInput) {
    return createWorkspace(this.workspaceRepository, input);
  }

  renameById(id: string, name: string) {
    return renameWorkspace(this.workspaceRepository, id, name);
  }

  moveById(id: string, projectId: string) {
    return moveWorkspace(this.workspaceRepository, id, projectId);
  }

  deleteById(id: string) {
    return deleteWorkspace(this.workspaceRepository, id);
  }
}
