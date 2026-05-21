import path from 'node:path';

import electron from 'electron';

import { validatePluginName } from './plugin-name';

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

  return pluginDir;
}
