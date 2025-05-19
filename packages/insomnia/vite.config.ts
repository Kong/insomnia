import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

import pkg from './package.json';
import { electronNodeRequire } from './vite-plugin-electron-node-require';

export default defineConfig(({ mode }) => {
  const __DEV__ = mode !== 'production';

  return {
    mode,
    root: path.join(__dirname, 'src'),
    base: __DEV__ ? '/' : './',
    define: {
      '__DEV__': JSON.stringify(__DEV__),
      'process.env.NODE_ENV': JSON.stringify(mode),
      'process.env.INSOMNIA_ENV': JSON.stringify(mode),
    },
    server: {
      port: pkg.dev['dev-server-port'],
      fs: {
        strict: true,
      },
    },
    build: {
      sourcemap: true,
      outDir: path.join(__dirname, 'build'),
      assetsDir: './',
      brotliSize: false,
      emptyOutDir: false,
      rollupOptions: {
        input: {
          mainWindow: path.join(__dirname, 'src/index.html'),
          hiddenBrowserWindow: path.join(__dirname, 'src/hidden-window.html'),
        },
        external: ['@getinsomnia/node-libcurl'],
      },
    },
    optimizeDeps: {
      exclude: ['@getinsomnia/node-libcurl'],
      // these packages are only used in web worker, Vite won't be able to discover the import on the initial scan，so we need to include them here to let vite pre-bundle them
      // https://vitejs.dev/guide/dep-pre-bundling.html#customizing-the-behavior
      include: [
        '@stoplight/spectral-core',
        '@stoplight/spectral-ruleset-bundler/with-loader',
        '@stoplight/spectral-rulesets',
        'codemirror-graphql/utils/SchemaReference',
        'openapi-types',
      ],
      force: true,
    },
    plugins: [react()],
    worker: {
      format: 'es',
      plugins: () => [
        electronNodeRequire({
          modules: ['fs'],
        }),
      ],
    },
  };
});
