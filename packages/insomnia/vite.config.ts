import path from 'node:path';

import { reactRouter } from '@react-router/dev/vite';
import tailwindcss from '@tailwindcss/vite';
import { defaultServerConditions, defineConfig } from 'vite';

import pkg from './package.json';

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
        external: ['@getinsomnia/node-libcurl', 'electron', /^electron\//],
      },
    },
    optimizeDeps: {
      exclude: ['@getinsomnia/node-libcurl', 'electron'],
      force: true, // wipe vite cache
      include: ['codemirror-graphql/utils/SchemaReference', '@stoplight/spectral-core', 'isomorphic-git', 'json-bigint'],
    },
    resolve: {
      alias: {
        // Resolve these adapters to their renderer variants so both client and server
        // builds inline the module directly (avoids runtime require() in server bundle).
        // These must appear before the '~' catch-all so the specific path wins.
        '~/network/network-adapter': path.resolve(__dirname, './src/network/network-adapter.renderer'),
        '~/templating/render-adapter': path.resolve(__dirname, './src/templating/render-adapter.renderer'),
        '~': path.resolve(__dirname, './src'),
        // Shim Node's `path` module for browser-safe dependencies (e.g. mime-types uses path.extname).
        'path': path.resolve(__dirname, './src/path-shim.ts'),
        // Shim Node's `events` module for browser-safe dependencies (e.g. jshint uses EventEmitter).
        'events': path.resolve(__dirname, '../../node_modules/events'),
      },
    },
    plugins: [reactRouter(), tailwindcss()],
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
