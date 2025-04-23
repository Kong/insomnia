import electron from 'electron';
import fs from 'fs';
import path from 'path';

export async function createPlugin(moduleName: string, version: string, mainJs: string) {
  // Use path.resolve to normalize the full plugin path and verify that it’s a subdirectory of your intended base directory
  const baseDir = path.resolve(
    process.env['INSOMNIA_DATA_PATH'] ||
    (process.type === 'renderer' ? window : electron).app.getPath('userData'),
    'plugins'
  );

  const pluginDir = path.resolve(path.join(baseDir, moduleName));

  // Ensure pluginDir is within baseDir
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
