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

  const pluginDir = path.resolve(baseDir, moduleName);

  // Ensure pluginDir is within baseDir (prevents path traversal)
  if (!pluginDir.startsWith(baseDir)) {
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
    fs.mkdirSync(pluginDir, { recursive: true });
    fs.writeFileSync(path.join(pluginDir, 'package.json'), JSON.stringify(
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
    ),);
    fs.writeFileSync(path.join(pluginDir, 'main.js'), mainJs);
  } catch (err) {
    console.error('Failed to create plugin:', err);
    throw new Error('Failed to create plugin');
  }
}
