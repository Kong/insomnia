import type { Workspace } from './workspace.entity';

export interface WorkspaceRepository {
  findById(id: string): Promise<Workspace | null>;
  findByProjectId(projectId: string): Promise<Workspace[]>;
  save(workspace: Workspace): Promise<void>;
  delete(id: string): Promise<void>;
}
