import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { getSafePluginDir } from '../utils/plugin';

export async function createPlugin(pluginName: string, mainJs: string) {
  const pluginDir = getSafePluginDir(pluginName);

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
