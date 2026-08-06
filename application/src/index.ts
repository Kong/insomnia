// application: use cases that orchestrate domain entities and repositories, plus
// cross-cutting application-level ports (NetworkClient, TemplatingEngine, Clock,
// IdGenerator, ...). Depends on domain only.
// Populated incrementally, one aggregate at a time.
export { Insomnia, type InsomniaDependencies } from './insomnia';
export { renameWorkspace } from './workspace/rename-workspace.use-case';
