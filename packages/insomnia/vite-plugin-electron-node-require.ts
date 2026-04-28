import { createRequire } from 'node:module';

import type { Plugin } from 'vite';

export interface Options {
  modules: string[];
}

/**
 * Allows Vite to import modules that will be resolved by Node's require() function.
 */
export function electronNodeRequire(options: Options): Plugin {
  const { modules = [] } = options;

  return {
    name: 'vite-plugin-electron-node-require',
    config(conf, env) {
      // If the plugin is used in SSR mode, we don't need to do anything
      if (env.isSsrBuild) {
        return conf;
      }
      // Exclude the modules from Vite's dependency optimization (pre-bundling)
      conf.optimizeDeps = {
        ...conf.optimizeDeps,
        exclude: [...(conf.optimizeDeps?.exclude ? conf.optimizeDeps.exclude : []), ...modules],
      };

      // Create aliases for the modules so that we can resolve them with this plugin
      conf.resolve ??= {};
      conf.resolve.alias = {
        ...conf.resolve.alias,
        ...Object.fromEntries(modules.map(e => [e, `virtual:external:${e}`])),
      };

      // Ignore the modules from Rollup's commonjs plugin so that we can resolve them with this plugin
      conf.build ??= {};
      conf.build.commonjsOptions ??= {};
      conf.build.commonjsOptions.ignore = [...modules];

      return conf;
    },
    resolveId(id, _importer, options) {
      const externalId = id.split('virtual:external:')[1];

      if (externalId && modules.includes(externalId)) {
        if (options.ssr) {
          return null;
        }
        // Return a virtual module ID so that Vite knows to use this plugin to resolve the module
        // The \0 is a special convention by Rollup to indicate that the module is virtual and should not be resolved by other plugins
        return `\0${id}`;
      }

      // Return null to indicate that this plugin should not resolve the module
      return null;
    },
    load(id, options) {
      if (id.includes('virtual:external:')) {
        const externalId = id.split('virtual:external:')[1];

        // We need to handle electron because it's different when required in the renderer process
        if (externalId === 'electron') {
          return `
            const electron = require('electron');
            export { electron as default };
            export const BrowserWindow = electron.BrowserWindow;
            export const clipboard = electron.clipboard;
            export const contextBridge = electron.contextBridge;
            export const crashReporter = electron.crashReporter;
            export const dialog = electron.dialog;
            export const ipcRenderer = electron.ipcRenderer;
            export const nativeImage = electron.nativeImage;
            export const shell = electron.shell;
            export const webFrame = electron.webFrame;
            export const deprecate = electron.deprecate;
          `;
        }

        const nodeRequire = createRequire(import.meta.url);
        const exports = Object.keys(nodeRequire(externalId));

        // Filter out the exports that are valid javascript variable keywords:
        const validExports = exports.filter(e => {
          try {
            new Function(`const ${e} = true`);
            return true;
          } catch {
            return false;
          }
        });

        if (options?.ssr) {
          return [
            `import requiredModule from '${externalId}';`,
            `${validExports.map(e => `export const ${e} = requiredModule.${e};`).join('\n')}`,
            `${exports.includes('default') ? 'export default requiredModule.default;' : 'export default requiredModule'}`,
          ].join('\n');
        }

        return [
          `const requiredModule = require('${externalId}');`,
          `${validExports.map(e => `export const ${e} = requiredModule.${e};`).join('\n')}`,
          `${exports.includes('default') ? 'export default requiredModule.default;' : 'export default requiredModule'}`,
        ].join('\n');
      }

      // Return null to indicate that this plugin should not resolve the module
      return null;
    },
  };
}
