import electron from 'electron';
import fs from 'fs';
import path from 'path';

// Validates a user-provided filename to prevent OS command injection.
export function getSafePluginDir(pluginName: string): string {
  const pluginNameWithoutPrefix = pluginName.replace(/^insomnia-plugin-/, '');

  // Allow only safe characters (alphanumeric, dashes, underscores, dots)
  // Disallow any path traversal (../), shell metacharacters, etc.
  const safePattern = /^[a-zA-Z0-9_\-\.]+$/;

  // Reject empty or overly long input
  if (!pluginNameWithoutPrefix || pluginNameWithoutPrefix.length > 255) {
    throw new Error('Plugin name must not be empty or too long');
  }

  // Prevent path traversal
  if (
    pluginNameWithoutPrefix.includes('..') ||
    pluginNameWithoutPrefix.includes('/') ||
    pluginNameWithoutPrefix.includes('\\')
  ) {
    throw new Error('Plugin name must not contain path traversal characters');
  }

  if (pluginNameWithoutPrefix.trim() === '-') {
    throw new Error('Plugin name must not be a single dash');
  }

  if (pluginNameWithoutPrefix.startsWith('-')) {
    throw new Error('Plugin name must not start with a dash');
  }

  if (pluginNameWithoutPrefix.endsWith('-')) {
    throw new Error('Plugin name must not end with a dash');
  }

  if (pluginNameWithoutPrefix.match(/--/)) {
    throw new Error('Plugin name must not contain consecutive dashes');
  }

  if (pluginNameWithoutPrefix.match(/^\./)) {
    throw new Error('Plugin name cannot start with a period');
  }

  if (pluginNameWithoutPrefix.match(/^_/)) {
    throw new Error('Plugin name cannot start with an underscore');
  }

  if (pluginNameWithoutPrefix.trim() !== pluginNameWithoutPrefix) {
    throw new Error('Plugin name cannot contain leading or trailing spaces');
  }

  if (encodeURIComponent(pluginNameWithoutPrefix) !== pluginNameWithoutPrefix) {
    throw new Error('Plugin name must be lowercase, alphanumeric, and dash-separated');
  }

  if (!safePattern.test(pluginNameWithoutPrefix)) {
    throw new Error('Plugin name must be lowercase, alphanumeric, and dash-separated');
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
  const pluginDir = path.resolve(path.join(baseDir, sanitizedModuleName));

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

export async function createPlugin(pluginName: string, mainJs: string) {
  const pluginDir = getSafePluginDir(pluginName);

  try {
    const packagePath = path.join(pluginDir, 'package.json');
    const mainJsPath = path.join(pluginDir, 'main.js');

    if (fs.existsSync(packagePath) || fs.existsSync(mainJsPath)) {
      throw new Error('Plugin files already exist');
    }

    fs.mkdirSync(pluginDir, { recursive: true });
    // 'wx' to write only if not exists
    fs.writeFileSync(
      packagePath,
      JSON.stringify(
        {
          name: pluginName,
          version: '0.0.1',
          private: true,
          insomnia: {
            name: pluginName.replace(/^insomnia-plugin-/, ''),
            description: '',
          },
          main: 'main.js',
        },
        null,
        2,
      ),
      { flag: 'wx' },
    );
    // 'wx' to write only if not exists
    fs.writeFileSync(mainJsPath, mainJs, { flag: 'wx' });
  } catch (err: any) {
    console.error('Failed to create plugin files:', err);
    throw new Error('Plugin creation failed. Please try again.');
  }
}
