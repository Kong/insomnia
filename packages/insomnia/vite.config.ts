import react from '@vitejs/plugin-react';
import { builtinModules } from 'module';
import path from 'path';
import { defineConfig } from 'vite';
import commonjsExternals from 'vite-plugin-commonjs-externals';

import pkg from './package.json';

// The list of packages we want to keep as commonJS require().
// Must be resolvable import paths, cannot be globs
// These will be available via Node's require function from the node_modules folder or Node's builtin modules
const commonjsPackages = [
  'electron',
  'electron/main',
  'electron/common',
  'electron/renderer',
  '@getinsomnia/node-libcurl',
  '@getinsomnia/node-libcurl/dist/enum/CurlAuth',
  '@getinsomnia/node-libcurl/dist/enum/CurlHttpVersion',
  '@getinsomnia/node-libcurl/dist/enum/CurlNetrc',
  'nunjucks/browser/nunjucks',
  ...Object.keys(pkg.dependencies),
  ...builtinModules,
];

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
    optimizeDeps: {
      exclude: commonjsPackages,
    },
    server: {
      port: pkg.dev['dev-server-port'],
      fs: {
        strict: true,
      },
    },
    build: {
      sourcemap: __DEV__,
      outDir: path.join(__dirname, 'build'),
      assetsDir: './',
      brotliSize: false,
      emptyOutDir: false,
      commonjsOptions: {
        ignore: commonjsPackages,
      },
    },
    plugins: [
      commonjsExternals({ externals: commonjsPackages }),
      react({
        fastRefresh: __DEV__,
        jsxRuntime: 'automatic',
        babel: {
          plugins: [
            ['@babel/plugin-proposal-decorators', { legacy: true }],
            ['@babel/plugin-proposal-class-properties', { loose: true }],
          ],
        },
      }),
    ],
  };
});
