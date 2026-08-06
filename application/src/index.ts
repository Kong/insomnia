// application: use cases that orchestrate domain entities and repositories, plus
// cross-cutting application-level ports (NetworkClient, TemplatingEngine, Clock,
// IdGenerator, ...). Depends on domain only.
// Populated incrementally, one aggregate at a time.
export { Insomnia, type InsomniaDependencies } from './insomnia';
export { createWorkspace } from './workspace/create-workspace.use-case';
export { deleteWorkspace } from './workspace/delete-workspace.use-case';
export { moveWorkspace } from './workspace/move-workspace.use-case';
export { renameWorkspace } from './workspace/rename-workspace.use-case';
