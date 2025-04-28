import electron from 'electron';
import fs from 'fs';
import path from 'path';

// Allow only safe characters (alphanumeric, dashes, underscores, dots)
// Disallow any path traversal (../), shell metacharacters, etc.
const safePattern = /^[a-zA-Z0-9_\-\.]+$/;

// Pattern for common shell metacharacters
const unsafeShellPattern = /[|;&$`\\]/;

export function validatePluginName(pluginName: string): string | null {
  const pluginNameWithoutPrefix = pluginName.replace(/^insomnia-plugin-/, '');

  if (pluginNameWithoutPrefix.startsWith('@')) {
    return 'Scoped packages are not allowed in this context';
  }

  // Reject empty or overly long input
  if (!pluginNameWithoutPrefix || pluginNameWithoutPrefix.length > 255) {
    return 'Plugin name must not be empty or too long';
  }

  // Prevent path traversal
  if (
    pluginNameWithoutPrefix.includes('..') ||
    pluginNameWithoutPrefix.includes('/') ||
    pluginNameWithoutPrefix.includes('\\')
  ) {
    return 'Plugin name must not contain path traversal characters';
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

  if (encodeURIComponent(pluginNameWithoutPrefix) !== pluginNameWithoutPrefix) {
    return 'Plugin name must be lowercase, alphanumeric, and dash-separated';
  }

  if (!safePattern.test(pluginNameWithoutPrefix)) {
    return 'Plugin name must be lowercase, alphanumeric, and dash-separated';
  }

  // Check for reserved or dangerous filenames
  // Reject plugin names like "con", "prn", "aux", "nul" and ".."
  const reserved = ['con', 'prn', 'aux', 'nul'];

  if (reserved.includes(pluginName.toLowerCase())) {
    return 'Plugin name is not allowed';
  }

  if (!pluginName.startsWith('insomnia-plugin-')) {
    return 'Plugin name must not start with "insomnia-plugin-"';
  }

  return null;
}

// Validates a user-provided filename to prevent OS command injection.
export function getSafePluginDir(pluginName: string): string {
  const validationError = validatePluginName(pluginName);

  if (validationError) {
    throw new Error(validationError);
  }

  // Sanitize moduleName to remove any unexpected characters or sequences
  // Remove '../' or path traversal attempts
  const sanitizedModuleName = pluginName.replace(/\.\.(\/|\\)/g, '');

  // Get base directory
  const baseDir = path.resolve(
    process.env['INSOMNIA_DATA_PATH'] || (process.type === 'renderer' ? window : electron).app.getPath('userData'),
    'plugins',
  );

  // Join and resolve the plugin path
  const pluginDir = path.resolve(path.resolve(baseDir, sanitizedModuleName));

  // Ensure the resolved path is within baseDir (no directory traversal)
  const relativePath = path.relative(baseDir, pluginDir);

  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error('Invalid plugin name: path traversal detected');
  }

  // Ensure the resolved path is within baseDir (no directory traversal)
  if (!pluginDir.startsWith(baseDir + path.sep)) {
    throw new Error('Invalid plugin name: path traversal detected');
  }

  // Check for reserved or dangerous filenames
  // Reject plugin names like "con", "prn", "aux", "nul" and ".."
  const reserved = ['con', 'prn', 'aux', 'nul'];

  if (reserved.includes(pluginName.toLowerCase())) {
    throw new Error('Plugin name is not allowed');
  }

  // Do not echoing a full path to the user. This might leak internal directory structure.
  if (fs.existsSync(pluginDir)) {
    throw new Error('Plugin already exists');
  }

  return pluginDir;
}
