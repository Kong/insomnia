import fs from 'fs';
import path from 'path';
import {addPlugin, getPlugins, runPluginHook} from './runner';

const CORE_PLUGINS = [
  'basic-auth',
];

const DEFAULT_PLUGINS = [
  'set-env',
];

export async function init () {

  for (const name of [...CORE_PLUGINS, ...DEFAULT_PLUGINS]) {
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
