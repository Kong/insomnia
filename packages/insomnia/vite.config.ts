import { builtinModules } from 'node:module';
import path from 'node:path';

import { reactRouter } from '@react-router/dev/vite';
import tailwindcss from '@tailwindcss/vite';
import { defaultServerConditions, defineConfig } from 'vite';

import pkg from './package.json';
//These will be excluded from the bundle and remain as runtime dependencies
export const externalDependencies = ['@apidevtools/swagger-parser', 'mocha'];
export default defineConfig(({ mode }) => {
  const __DEV__ = mode !== 'production';
  const browserSafeBuiltinModules = new Set(['assert', 'buffer', 'events', 'path', 'util']);
  const nodeBuiltinModules = builtinModules.filter(m => !browserSafeBuiltinModules.has(m));

  return {
    define: {
      '__DEV__': JSON.stringify(__DEV__),
      'process.env.NODE_ENV': JSON.stringify(mode),
      'process.env.INSOMNIA_ENV': JSON.stringify(mode),
      // Only apply in production builds: Rollup does text substitution (safe).
      // In dev mode Vite uses runtime assignment via env.mjs, which throws
      // TypeError because process.type is read-only in Electron's renderer process.
      ...(!__DEV__ ? { 'process.type': JSON.stringify('renderer') } : {}),
    },
    server: {
      port: pkg.dev['dev-server-port'],
      warmup: {
        clientFiles: [
          // https://github.com/remix-run/react-router/issues/12786#issuecomment-2634033513
          './src/components/**/*',
          './src/entry.client.tsx',
          './src/root.tsx',
          './src/routes/**/*',
          '!**/*.server.ts',
        ],
      },
    },

    build: {
      target: 'esnext',
      sourcemap: true,
      rollupOptions: {
        external: ['@getinsomnia/node-libcurl'],
      },
    },
    optimizeDeps: {
      exclude: ['@getinsomnia/node-libcurl'],
      force: true, // wipe vite cache
      include: ['codemirror-graphql/utils/SchemaReference', '@stoplight/spectral-core', 'isomorphic-git', 'json-bigint'],
    },
    resolve: {
      alias: {
        // Short-circuit the adapter wrappers to the renderer implementation directly.
        // These must appear before the '~' catch-all so the specific path wins.
        '~/network/network-adapter': path.resolve(__dirname, './src/network/network-adapter.renderer'),
        '~/templating/render-adapter': path.resolve(__dirname, './src/templating/render-adapter.renderer'),
        '~/utils/crypt-adapter': path.resolve(__dirname, './src/utils/crypt-adapter.renderer'),
        '~': path.resolve(__dirname, './src'),
        // Shim Node's `path` module for browser-safe dependencies (e.g. mime-types uses path.extname).
        'path': path.resolve(__dirname, './src/path-shim.ts'),
        'node:path': path.resolve(__dirname, './src/path-shim.ts'),
        // Shim Node's `assert` module for browser-safe dependencies that still use runtime invariants.
        'assert': path.resolve(__dirname, '../../node_modules/assert'),
        'node:assert': path.resolve(__dirname, '../../node_modules/assert'),
        // Shim Node's `events` module for browser-safe dependencies (e.g. jshint uses EventEmitter).
        'events': path.resolve(__dirname, '../../node_modules/events'),
        'node:events': path.resolve(__dirname, '../../node_modules/events'),
        // Shim Node's `util` module for browser-safe dependencies (e.g. tough-cookie uses util.inherits).
        'util': path.resolve(__dirname, '../../node_modules/util'),
        'node:util': path.resolve(__dirname, '../../node_modules/util'),
        // Buffer is also browser-safe in this renderer bundle, so keep it bundled instead of externalized.
        'buffer': path.resolve(__dirname, '../../node_modules/buffer'),
        'node:buffer': path.resolve(__dirname, '../../node_modules/buffer'),
      },
    },
    plugins: [
      // Allows us to import modules that will be resolved by Node's require() function.
      // e.g. import fs from 'fs'; will get transformed to const fs = require('fs'); so that it works in the renderer process.
      // This is necessary because we use nodeIntegration: true in the renderer process and allow importing modules from node.
      electronNodeRequire({
        modules: [
          'electron',
          ...externalDependencies,
          ...nodeBuiltinModules,
          ...nodeBuiltinModules.map(m => `node:${m}`),
        ],
      }),
      reactRouter(),
      tailwindcss(),
    ],
    worker: {
      format: 'es',
    },
    // The Electron renderer is browser-like even in React Router's SSR (server) build.
    // Vite's DEFAULT_SERVER_CONDITIONS excludes "browser", so packages with a
    // "browser" exports condition (e.g. insomnia-testing) would otherwise resolve to
    // their full Node entry point in the server bundle — pulling in Node-only modules
    // like mocha. Prepending "browser" here keeps the server bundle consistent with
    // the client build while retaining all other default server conditions.
    ssr: {
      resolve: {
        conditions: ['browser', ...defaultServerConditions],
      },
    },
  };
});
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
  const getExternalId = (id: string) => id.split('virtual:external:')[1]?.split('?')[0];

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
      const externalId = getExternalId(id);

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
        const externalId = getExternalId(id);

        if (!externalId) {
          return null;
        }

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
