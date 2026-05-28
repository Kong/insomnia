import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import electron from 'electron';

import { validatePluginName } from '../utils/plugin-name';

function stripPathTraversal(name: string, maxIterations = 20): string {
  let result = name;
  for (let i = 0; i < maxIterations; i++) {
    const next = result.replace(/\.\.(\/|\\)/g, '');
    if (next === result) {
      return result;
    }
    result = next;
  }
  throw new Error('Invalid plugin name: path traversal detected');
}

// Validates a user-provided filename to prevent OS command injection.
export function getSafePluginDir(pluginName: string): string {
  const validationError = validatePluginName(pluginName);

  if (validationError) {
    throw new Error(validationError);
  }

  const sanitizedModuleName = stripPathTraversal(pluginName);

  // Get base directory
  const baseDir = path.resolve(process.env['INSOMNIA_DATA_PATH'] || electron.app.getPath('userData'), 'plugins');

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
  if (existsSync(pluginDir)) {
    throw new Error('Plugin already exists');
  }

  return pluginDir;
}

export async function createPlugin(pluginName: string, mainJs: string) {
  const pluginDir = getSafePluginDir(pluginName);

  if (existsSync(pluginDir)) {
    throw new Error('Plugin already exists');
  }

  try {
    const packagePath = path.resolve(pluginDir, 'package.json');
    const mainJsPath = path.resolve(pluginDir, 'main.js');

    await mkdir(pluginDir, { recursive: true });
    await writeFile(
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
    await writeFile(mainJsPath, mainJs, { flag: 'wx' });
  } catch (err: any) {
    if (err.code === 'EEXIST') {
      throw new Error('Plugin already exists');
    }
    console.error('Failed to create plugin files:', err);
    throw new Error('Plugin creation failed. Please try again.');
  }
}
