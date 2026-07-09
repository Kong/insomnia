/**
 * Parsing + validation for a plugin's declared `insomnia.permissions` manifest (sandbox plan C3).
 *
 * Two independent, default-deny grant axes:
 *   - `modules`      — registry names the plugin may `require()` inside the sandbox (axis 1, M1).
 *   - `capabilities` — host-bridge groups the plugin may call out to (axis 2; gating lands in C1).
 *
 * Both are parsed here so the loader can attach them to the `Plugin` and the Preferences → Plugins
 * pane can display them. A malformed manifest never throws: it degrades to no declared permissions
 * (baseline access) and surfaces a human-readable warning on the plugin's card.
 */

export interface PluginPermissions {
  /** Registry-module names the plugin declares it needs (axis 1). */
  modules: string[];
  /** Host-capability groups the plugin declares it needs (axis 2; consumed by C1). */
  capabilities: string[];
}

export interface ParsedPluginPermissions {
  permissions: PluginPermissions;
  /** Validation warnings, shown on the plugin card and logged. Empty when the manifest is clean. */
  warnings: string[];
  /**
   * True when the plugin declared a valid `permissions` object (even if empty); false when it was
   * absent or malformed. Distinguishes "declared-but-empty" from "baseline access (no manifest)".
   */
  declared: boolean;
}

const emptyPermissions = (): PluginPermissions => ({ modules: [], capabilities: [] });

// Validate one string[] axis. Non-arrays yield a warning and an empty axis; within an array, only
// non-empty strings are kept (other entries are dropped with a warning). De-duplicates.
const parseStringArrayAxis = (value: unknown, axis: string, warnings: string[]): string[] => {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    warnings.push(`insomnia.permissions.${axis} must be an array of strings; ignoring it (baseline access).`);
    return [];
  }
  const valid: string[] = [];
  for (const entry of value) {
    if (typeof entry === 'string' && entry.length > 0) {
      if (!valid.includes(entry)) {
        valid.push(entry);
      }
    } else {
      warnings.push(
        `insomnia.permissions.${axis} entries must be non-empty strings; ignoring ${JSON.stringify(entry)}.`,
      );
    }
  }
  return valid;
};

/**
 * Parse the `insomnia` field of a plugin's package.json into validated permissions. `insomniaField`
 * is `pluginJson.insomnia` (already known to exist — the loader skips packages without it).
 */
export const parsePluginPermissions = (insomniaField: unknown): ParsedPluginPermissions => {
  const warnings: string[] = [];

  if (insomniaField === null || typeof insomniaField !== 'object') {
    return { permissions: emptyPermissions(), warnings, declared: false };
  }

  const permissionsField = (insomniaField as { permissions?: unknown }).permissions;
  if (permissionsField === undefined) {
    return { permissions: emptyPermissions(), warnings, declared: false };
  }
  if (permissionsField === null || typeof permissionsField !== 'object' || Array.isArray(permissionsField)) {
    warnings.push('insomnia.permissions must be an object; ignoring it (baseline access).');
    return { permissions: emptyPermissions(), warnings, declared: false };
  }

  const { modules, capabilities } = permissionsField as { modules?: unknown; capabilities?: unknown };
  return {
    permissions: {
      modules: parseStringArrayAxis(modules, 'modules', warnings),
      capabilities: parseStringArrayAxis(capabilities, 'capabilities', warnings),
    },
    warnings,
    declared: true,
  };
};
