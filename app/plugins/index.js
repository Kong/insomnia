import mkdirp from 'mkdirp';
import fs from 'fs';
import path from 'path';
import {PLUGIN_PATH} from '../common/constants';
import {render} from '../templating';
// import * as models from '../models/index';

let plugins = [];

export async function init () {
  // Make sure the directories exist
  mkdirp.sync(PLUGIN_PATH);

  // Set the plugins
  // plugins = await models.pluginInstall.all();
  for (const dir of fs.readdirSync(PLUGIN_PATH)) {
    if (dir.indexOf('.') === 0) {
      continue;
    }

    // Use global.require() instead of require() because Webpack wraps require()
    plugins.push(global.require(path.join(PLUGIN_PATH, dir)));
  }
}

export async function createPlugin (name) {
  // Create root plugin dir
  const dir = path.join(PLUGIN_PATH, name);
  mkdirp.sync(dir);

  fs.writeFileSync(path.join(dir, 'plugin.js'), pluginJS);

  const renderedPackageJson = await render(packageJson, {context: {name}});
  fs.writeFileSync(path.join(dir, 'package.json'), renderedPackageJson);
}

export function getTemplateTags () {
  let extensions = [];
  for (const {templateTags} of plugins) {
    extensions = [...extensions, ...(templateTags || [])];
  }

  return extensions;
}

const pluginJS = `
export const templateTags = [{
  name: 'hello',
  displayName: 'Hello World!',
  description: 'A tag to print "Hello World!"',
  args: [],
  async run () {
    return 'Hello World!'
  }
}];
`.trim();

const packageJson = JSON.stringify({
  name: '{{ name }}',
  version: '0.0.1',
  private: true,
  main: 'plugin.js',
  description: 'A plugin for Insomnia',
  dependencies: {},
  devEngines: {
    node: '7.4',
    npm: '4.x | 5.x'
  }
}, null, '\t');
