import type { PluginExportManifest } from '~/templating/sandbox/marshal';

// Shared registry for the sandbox-backed user-plugin export discovery. `plugins/index` runs in both
// the main process and the renderer (plugin window) and must not statically import
// `main/templating-worker-database` (the main-side implementation) — that module in turn loads
// `plugins/index` for getPlugins/getTemplateTags, which would be a circular dependency. Keeping the
// registration slot in this neutral module lets both sides depend on it without importing each other.
export type UserPluginExportDiscovery = (body: {
  directory: string;
  name: string;
  permissions?: { modules?: string[]; capabilities?: string[] };
}) => Promise<PluginExportManifest>;

let discoverUserPluginExportsInMain: UserPluginExportDiscovery | null = null;

export function registerUserPluginExportDiscovery(discover: UserPluginExportDiscovery): void {
  discoverUserPluginExportsInMain = discover;
}

export function getRegisteredUserPluginExportDiscovery(): UserPluginExportDiscovery {
  if (!discoverUserPluginExportsInMain) {
    throw new Error('User plugin export discovery is not registered; main/templating-worker-database did not load in the main process');
  }
  return discoverUserPluginExportsInMain;
}
