// Allow only safe characters (alphanumeric, dashes, underscores, dots)
// Disallow any path traversal (../), shell metacharacters, etc.
const safePattern = /^[a-zA-Z0-9_\-\.]+$/;

// TODO (pavkout): Remove this when we stop supporting scoped package names
// For scoped names
const scopedSafePattern = /^@[a-zA-Z0-9_\-\.]+\/[a-zA-Z0-9_\-\.]+$/;

// Pattern for common shell metacharacters
const unsafeShellPattern = /[|;&$`\\]/;

export function validatePluginName(pluginName: string, allowScopedPackageNames = false): string | null {
  const pluginNameWithoutPrefix = pluginName.replace(/^insomnia-plugin-/, '');

  // Check the length of the plugin name
  // Plugin name must be less than 214 characters
  if (pluginNameWithoutPrefix.trim().length === 0 || pluginNameWithoutPrefix.length > 214) {
    return 'Plugin name must not be empty or too long';
  }

  if (pluginNameWithoutPrefix.startsWith('@') && !allowScopedPackageNames) {
    return 'Scoped packages are not permitted in this context. To install scoped packages, please use the Plugin Host instead.';
  }

  // Prevent path traversal
  if (allowScopedPackageNames) {
    // Allow scoped package names to contain slashes
    if (
      (pluginNameWithoutPrefix.startsWith('@') && pluginNameWithoutPrefix.split('/').length > 2) ||
      pluginNameWithoutPrefix.includes('..') ||
      pluginNameWithoutPrefix.includes('\\')
    ) {
      return 'Plugin name must not contain path traversal characters';
    }
  } else {
    if (
      pluginNameWithoutPrefix.includes('..') ||
      pluginNameWithoutPrefix.includes('/') ||
      pluginNameWithoutPrefix.includes('\\')
    ) {
      return 'Plugin name must not contain path traversal characters';
    }
  }

  if (unsafeShellPattern.test(pluginNameWithoutPrefix)) {
    return 'Plugin name must not contain shell metacharacters';
  }

  if (pluginNameWithoutPrefix.trim() === '-') {
    return 'Plugin name must not be a single dash';
  }

  if (pluginNameWithoutPrefix.startsWith('-')) {
    return 'Plugin name must not start with a dash';
  }

  if (pluginNameWithoutPrefix.endsWith('-')) {
    return 'Plugin name must not end with a dash';
  }

  if (pluginNameWithoutPrefix.match(/--/)) {
    return 'Plugin name must not contain consecutive dashes';
  }

  if (pluginNameWithoutPrefix.match(/^\./)) {
    return 'Plugin name cannot start with a period';
  }

  if (pluginNameWithoutPrefix.match(/^_/)) {
    return 'Plugin name cannot start with an underscore';
  }

  if (pluginNameWithoutPrefix.trim() !== pluginNameWithoutPrefix) {
    return 'Plugin name cannot contain leading or trailing spaces';
  }

  if (encodeURIComponent(pluginNameWithoutPrefix) !== pluginNameWithoutPrefix && !allowScopedPackageNames) {
    return 'Plugin name must be lowercase, alphanumeric, and dash-separated';
  }

  // Check if scoped package names are allowed
  // TODO (pavkout): Remove this when we stop supporting scoped package names
  if (allowScopedPackageNames) {
    if (!scopedSafePattern.test(pluginNameWithoutPrefix) && !safePattern.test(pluginNameWithoutPrefix)) {
      return 'Plugin name must be lowercase, alphanumeric, and dash-separated. Scoped names must follow the @scope/package format.';
    }
  } else {
    if (!safePattern.test(pluginNameWithoutPrefix)) {
      return 'Plugin name must be lowercase, alphanumeric, and dash-separated.';
    }
  }

  // Check for reserved or dangerous filenames
  // Reject plugin names like "con", "prn", "aux", "nul" and ".."
  const reserved = ['con', 'prn', 'aux', 'nul'];

  if (reserved.includes(pluginNameWithoutPrefix.toLowerCase())) {
    return 'Plugin name is not allowed';
  }

  if (!pluginName.startsWith('insomnia-plugin-') && !allowScopedPackageNames) {
    return 'Plugin name must start with "insomnia-plugin-"';
  }

  return null;
}
