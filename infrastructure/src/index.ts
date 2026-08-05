// infrastructure: adapters implementing domain- and application-defined ports
// (persistence, network, sync, secret storage). Depends on domain plus external
// libs/Electron/Node. Only reachable from each app's own bootstrap/wiring code.
// Populated incrementally, one aggregate at a time.
export { nedbEnvironmentRepository } from './persistence/nedb/nedb-environment-repository';
export { nedbWorkspaceRepository } from './persistence/nedb/nedb-workspace-repository';
