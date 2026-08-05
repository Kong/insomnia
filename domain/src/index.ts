// domain: pure business logic - entities, value objects, and the Repository/port
// interfaces implemented by infrastructure. No I/O, no framework or runtime dependencies.
// Populated incrementally, one aggregate at a time.
export type { Entity } from './shared/entity';
export type { Workspace, WorkspaceScope } from './workspace/workspace.entity';
export type { WorkspaceRepository } from './workspace/workspace-repository.port';
