// @flow
import fs from 'fs';
import path from 'path';
import mkdirp from 'mkdirp';
import rimraf from 'rimraf';
import { PLUGIN_PATH } from '../common/constants';

export async function createPlugin(
  moduleName: string,
  version: string,
  mainJs: string,
): Promise<void> {
  const pluginDir = path.join(PLUGIN_PATH, moduleName);

  if (fs.existsSync(pluginDir)) {
    throw new Error(`Plugin already exists at "${pluginDir}"`);
  }

  rimraf.sync(pluginDir);
  mkdirp.sync(pluginDir);

  // Write package.json
  fs.writeFileSync(
    path.join(pluginDir, 'package.json'),
    JSON.stringify(
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
    ),
  );

  // Write main JS file
  fs.writeFileSync(path.join(pluginDir, 'main.js'), mainJs);
}
