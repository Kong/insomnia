// T1: the single source of truth for "does this plugin surface run in the sandbox?".
//
// Before T1 a per-surface condition was duplicated across every execution surface (template tags,
// request/response hooks, actions, and load-time discovery). T1 centralises it here so all surfaces
// agree, reads the `pluginSandboxEnabled` flag, and honours the per-plugin `elevated` escape hatch.
//
// Pure and dependency-free (no electron, no node builtins) so it is safe to import from the main
// process, the plugin (renderer) window, and the inso CLI's node runtime alike.

/** The minimal settings shape the sandbox decision depends on. */
export interface SandboxSettings {
  pluginSandboxEnabled?: boolean;
}

/** The minimal plugin shape the sandbox decision depends on. */
export interface SandboxPlugin {
  /** '' = bundle/first-party (trusted); non-empty = user plugin on disk. */
  directory: string;
  config?: { elevated?: boolean };
}

/** Is the sandbox globally active? Driven by the single `pluginSandboxEnabled` setting. */
export const isSandboxEnabled = (settings?: SandboxSettings): boolean =>
  !!settings?.pluginSandboxEnabled;

export type PluginExecutionMode =
  // Built-in/bundled plugin — ships with Insomnia, always runs in-process with full host access.
  | 'internal'
  // User plugin, sandbox on, not elevated — runs in the QuickJS sandbox (default-deny).
  | 'sandboxed'
  // User plugin the user explicitly elevated — runs in-process with full host access.
  | 'elevated'
  // User plugin, sandbox off — legacy in-process execution (not a deliberate trust decision).
  | 'unsandboxed';

/**
 * The execution mode for a single plugin, given the current settings. Used for the 7 gate sites
 * (via `shouldSandboxPlugin`) and for the Preferences → Plugins mode indicator.
 */
export const resolvePluginExecutionMode = (
  settings: SandboxSettings | undefined,
  plugin: SandboxPlugin,
): PluginExecutionMode => {
  // Built-in plugins are trusted by design (e.g. external-vault's unsafePluginMainActions).
  if (!plugin.directory) {
    return 'internal';
  }
  // Sandbox off entirely → user plugins run in-process as they always did (legacy path).
  if (!isSandboxEnabled(settings)) {
    return 'unsandboxed';
  }
  // Sandbox on, but the user opted this specific plugin back into full-host execution.
  if (plugin.config?.elevated) {
    return 'elevated';
  }
  return 'sandboxed';
};

/**
 * The one boolean every execution surface asks: should THIS plugin's untrusted code run in the
 * sandbox right now? True only for a user plugin, sandbox enabled, not elevated.
 */
export const shouldSandboxPlugin = (settings: SandboxSettings | undefined, plugin: SandboxPlugin): boolean =>
  resolvePluginExecutionMode(settings, plugin) === 'sandboxed';
