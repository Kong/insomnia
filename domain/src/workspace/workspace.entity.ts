import type { Entity } from '../shared/entity';

export type WorkspaceScope = 'design' | 'collection' | 'mock-server' | 'environment' | 'mcp';

export interface Workspace extends Entity {
  type: 'Workspace';
  name: string;
  description: string;
  scope: WorkspaceScope;
  konnectServiceId?: string | null;
}
