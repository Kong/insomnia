import fs from 'fs';
import path from 'path';
import {addPlugin, getPlugins, runPluginHook} from './runner';

export async function init () {
  const pluginFiles = [
    'basic-auth',
    'set-env',
  ];

  for (const name of pluginFiles) {
    const fullPath = path.resolve(`./sample-scripts/${name}.js`);
    try {
      addPlugin(fs.readFileSync(fullPath));
    } catch (err) {
      console.warn(`Failed to load core plugin ${name}`);
    }
  }

  console.log('PLUGINS', getPlugins());
  await runPluginHook('send::response');
}
