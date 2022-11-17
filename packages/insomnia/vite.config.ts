import react from '@vitejs/plugin-react';
import { builtinModules } from 'module';
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
      __DEV__: JSON.stringify(__DEV__),
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
        external: ['@getinsomnia/node-libcurl'],
      },
    },
    optimizeDeps: {
      exclude: ['@getinsomnia/node-libcurl'],
    },
    plugins: [
      electronNodeRequire({
        modules: [
          'electron',
          ...Object.keys(pkg.dependencies),
          ...builtinModules.filter(m => m !== 'buffer'),
          ...builtinModules.map(m => `node:${m}`),
        ],
      }),
      react({
        fastRefresh: __DEV__,
        jsxRuntime: 'automatic',
        babel: {
          plugins: [
            // We need to have these plugins installed in our dependencies
            ['@babel/plugin-proposal-class-properties', { loose: true }],
          ],
        },
      }),
    ],
  };
});
