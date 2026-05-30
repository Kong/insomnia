import { builtinModules } from 'node:module';
import path from 'node:path';

import { reactRouter } from '@react-router/dev/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

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
      include: ['codemirror-graphql/utils/SchemaReference', '@stoplight/spectral-core', 'isomorphic-git'],
    },
    resolve: {
      alias: {
        // Resolve network-adapter to the renderer variant so both client and server
        // builds inline the module directly (avoids runtime require() in server bundle).
        '~/network/network-adapter': path.resolve(__dirname, './src/network/network-adapter.renderer'),
        '~': path.resolve(__dirname, './src'),
      },
    },
    plugins: [
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
    ],
    worker: {
      format: 'es',
    },
  };
});
