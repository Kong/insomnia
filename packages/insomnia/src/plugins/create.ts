import electron from 'electron';
import fs from 'fs';
import path from 'path';

// Helper function to validate and sanitize plugin name
export function getSafePluginDir(moduleName: string): string {
  // 1. Validate that moduleName follows allowed pattern (no '../' allowed)
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(moduleName)) {
    throw new Error('Invalid plugin name: must be lowercase, alphanumeric, and dash-separated');
  }

  // 2. Sanitize moduleName to remove any unexpected characters or sequences
  const sanitizedModuleName = moduleName.replace(/\.\.(\/|\\)/g, ''); // Remove '../' or path traversal attempts

  // 3. Get base directory
  const baseDir = path.resolve(
    process.env['INSOMNIA_DATA_PATH'] ||
    (process.type === 'renderer' ? window : electron).app.getPath('userData'),
    'plugins'
  );

  // 4. Join and resolve the plugin path
  const pluginDir = path.resolve(path.join(baseDir, sanitizedModuleName));

  // 5. Ensure the resolved path is within baseDir (no directory traversal)
  if (!pluginDir.startsWith(baseDir + path.sep)) {
    throw new Error('Invalid plugin name: path traversal detected');
  }

  // Check for reserved or dangerous filenames
  // Reject plugin names like "con", "prn", "aux", "nul" and ".."
  const reserved = ['con', 'prn', 'aux', 'nul'];

  if (reserved.includes(moduleName.toLowerCase()) || moduleName.includes('..')) {
    throw new Error('Plugin name is not allowed');
  }

  // Do not echoing a full path to the user. This might leak internal directory structure.
  if (fs.existsSync(pluginDir)) {
    throw new Error('Plugin already exists');
  }

  return pluginDir;
}

export async function createPlugin(moduleName: string, version: string, mainJs: string) {
  const pluginDir = getSafePluginDir(moduleName);
  
  try {
    const packagePath = path.join(pluginDir, 'package.json');
    const mainJsPath = path.join(pluginDir, 'main.js');

    if (fs.existsSync(packagePath) || fs.existsSync(mainJsPath)) {
      throw new Error('Plugin files already exist');
    }

    fs.mkdirSync(pluginDir, { recursive: true });
    // 'wx' to write only if not exists
    fs.writeFileSync(packagePath, JSON.stringify(
      {
        name: moduleName,
        version,
        private: true,
        insomnia: {
          name: moduleName.replace(/^insomnia-plugin-/, ''),
          description: '',
        },
        main: 'main.js',
      },
      null,
      2,
    ), { flag: 'wx' }); 
    // 'wx' to write only if not exists
    fs.writeFileSync(mainJsPath, mainJs, { flag: 'wx' });
  } catch (err: any) {
    console.error('Failed to create plugin files:', err);
    throw new Error('Plugin creation failed. Please try again.');
  }
}
