import type { Workspace, WorkspaceScope } from './workspace.entity';

export interface CreateWorkspaceInput {
  name: string;
  scope: WorkspaceScope;
  parentId: string;
  description?: string;
}

export interface WorkspaceRepository {
  findById(id: string): Promise<Workspace | null>;
  findByProjectId(projectId: string): Promise<Workspace[]>;
  create(input: CreateWorkspaceInput): Promise<Workspace>;
  save(workspace: Workspace): Promise<void>;
  delete(id: string): Promise<void>;
}
