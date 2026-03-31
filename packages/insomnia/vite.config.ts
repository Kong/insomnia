import { builtinModules } from 'node:module';
import path from 'node:path';

import { reactRouter } from '@react-router/dev/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, type Plugin } from 'vite';

import pkg from './package.json';
import { electronNodeRequire } from './vite-plugin-electron-node-require';
//These will be excluded from the bundle and remain as runtime dependencies
export const externalDependencies = ['@apidevtools/swagger-parser', 'mocha', 'tough-cookie'];
export default defineConfig(({ mode }) => {
  const __DEV__ = mode !== 'production';

  return {
    define: {
      '__DEV__': JSON.stringify(__DEV__),
      'process.env.NODE_ENV': JSON.stringify(mode),
      'process.env.INSOMNIA_ENV': JSON.stringify(mode),
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
      include: ['codemirror-graphql/utils/SchemaReference', '@stoplight/spectral-core', 'isomorphic-git'],
    },
    resolve: {
      alias: {
        '~': path.resolve(__dirname, './src'),
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
          ...builtinModules.filter(m => m !== 'buffer'),
          ...builtinModules.map(m => `node:${m}`),
        ],
      }),
      reactRouter(),
      tailwindcss(),
      DetectNodeBuiltinImports(),
    ],
    worker: {
      format: 'es',
    },
  };
});
let totalWarnings = 0;
function DetectNodeBuiltinImports() {
  const builtins = new Set(builtinModules);
  const importersByModule = new Map<string, Set<string>>();
  const scriptExtensions = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.mts', '.cts']);

  const normalizeId = (id: string) => id.replace(/^\/@@fs\//, '/').replace(/\?.*$/, '');
  const shouldTrack = (id: string) =>
    !id.includes('node_modules') && !id.startsWith('\0') && !id.startsWith('virtual:');
  const isScriptModule = (id: string) => scriptExtensions.has(path.extname(id));
  const isBuiltinImport = (source: string) =>
    builtins.has(source) ||
    builtins.has(source.replace(/^node:/, '')) ||
    builtins.has(source.replace('virtual:external:node:', ''));
  const displayPath = (id: string) => {
    const normalizedId = normalizeId(id);
    return path.isAbsolute(normalizedId) ? path.relative(process.cwd(), normalizedId) : normalizedId;
  };
  const recordImporter = (moduleId: string, importerId: string) => {
    const trackedImporters = importersByModule.get(moduleId) ?? new Set<string>();
    trackedImporters.add(importerId);
    importersByModule.set(moduleId, trackedImporters);
  };
  const buildImportChain = (moduleId: string) => {
    const chain = [moduleId];
    const seen = new Set(chain);
    let current = moduleId;

    while (true) {
      const importers = importersByModule.get(current);
      const nextImporter = importers ? [...importers].find(importer => !seen.has(importer)) : undefined;

      if (!nextImporter) {
        break;
      }

      chain.unshift(nextImporter);
      seen.add(nextImporter);
      current = nextImporter;
    }

    return chain.map(displayPath).join(' -> ');
  };

  const plugin: Plugin = {
    name: 'detect-node-builtin-imports',

    async transform(code: string, id: string) {
      const normalizedId = normalizeId(id);

      if (!shouldTrack(normalizedId) || !isScriptModule(normalizedId)) {
        return null;
      }

      let parsed: { body?: unknown[] };

      try {
        parsed = this.parse(code) as unknown as { body?: unknown[] };
      } catch {
        return null;
      }

      const importSources = new Set<string>();
      const visitNode = (node: unknown): void => {
        if (!node || typeof node !== 'object') {
          return;
        }

        const candidate = node as {
          type?: string;
          source?: { value?: unknown };
          body?: unknown[];
        };

        if (
          (candidate.type === 'ImportDeclaration' ||
            candidate.type === 'ExportAllDeclaration' ||
            candidate.type === 'ExportNamedDeclaration') &&
          typeof candidate.source?.value === 'string'
        ) {
          importSources.add(candidate.source.value);
        }

        if (candidate.type === 'ImportExpression' && typeof candidate.source?.value === 'string') {
          importSources.add(candidate.source.value);
        }

        for (const value of Object.values(candidate)) {
          if (Array.isArray(value)) {
            for (const child of value) {
              visitNode(child);
            }
          } else {
            visitNode(value);
          }
        }
      };

      for (const node of parsed.body ?? []) {
        visitNode(node);
      }

      for (const source of importSources) {
        if (isBuiltinImport(source)) {
          const file = displayPath(normalizedId);
          const importChain = buildImportChain(normalizedId);
          totalWarnings += 1;
          console.warn(
            `⚠️  ${totalWarnings} File "${file}" imports Node builtin module "${source}" via "${importChain}"`,
          );
          continue;
        }

        const resolution = await this.resolve(source, id, { skipSelf: true });
        const resolvedId = resolution?.id ? normalizeId(resolution.id) : null;

        if (resolvedId && shouldTrack(resolvedId)) {
          recordImporter(resolvedId, normalizedId);
        }
      }

      return null;
    },
  };

  return plugin;
}
