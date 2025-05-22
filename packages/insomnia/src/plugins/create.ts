import fs from 'fs';
import path from 'path';

import { getSafePluginDir } from '../utils/plugin';

export async function createPlugin(pluginName: string, mainJs: string) {
  const pluginDir = getSafePluginDir(pluginName);

  try {
    const packagePath = path.resolve(pluginDir, 'package.json');
    const mainJsPath = path.resolve(pluginDir, 'main.js');

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
