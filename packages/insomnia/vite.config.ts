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
      '__IS_RENDERER__': JSON.stringify(true),
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
      include: [
        'codemirror-graphql/utils/SchemaReference',
        '@stoplight/spectral-core',
        'isomorphic-git',
        'json-bigint',
        '@faker-js/faker',
      ],
    },
    resolve: {
      alias: {
        '~': path.resolve(__dirname, './src'),
        // mime-types uses path.extname
        'path': path.resolve(__dirname, './src/path-shim.ts'),
        // jshint uses EventEmitter
        'events': path.resolve(__dirname, '../../node_modules/events'),
        // jshint uses util
        'util': path.resolve(__dirname, '../../node_modules/util'),
        // isomorphic-git/sha.js/safe-buffer use Buffer
        'buffer': path.resolve(__dirname, '../../node_modules/buffer'),
      },
    },
    plugins: [reactRouter(), tailwindcss()],
    worker: {
      format: 'es',
    },
    // The Electron renderer is browser-like even in React Router's SSR (server) build.
    // Vite's DEFAULT_SERVER_CONDITIONS excludes "browser", so packages with a
    // "browser" exports condition would otherwise resolve to their full Node entry point
    // in the server bundle — pulling in Node-only modules. Prepending "browser" here
    // keeps the server bundle consistent with the client build while retaining all other
    // default server conditions.
    ssr: {
      resolve: {
        conditions: ['browser', ...defaultServerConditions],
      },
    },
  };
});
