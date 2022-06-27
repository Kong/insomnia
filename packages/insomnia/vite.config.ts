import react from '@vitejs/plugin-react';
import { builtinModules } from 'module';
import path from 'path';
import { defineConfig, Plugin } from 'vite';
import commonjsExternals from 'vite-plugin-commonjs-externals';

import pkg from './package.json';

// Preload all the dynamic chunks for the app
const chunkPreloadPlugin = (): Plugin => {
  return {
    name: 'chunk-preload-transform',
    transformIndexHtml(html, context) {
      // Add modulepreload links to the html if the module is imported dynamically
      const { bundle } = context;

      if (bundle) {
        const modules = Object.keys(bundle).filter(fileName => bundle[fileName].type === 'chunk');

        const makePreloadLink = (module: string) => {
          return `<link rel="modulepreload" href="./${module}">`;
        };

        const links = modules.map(makePreloadLink);

        return html.replace(
          '</head>',
          `${links.join('\n')}</head>`
        );
      } else {
        return html;
      }
    },
  };
};

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
      chunkPreloadPlugin(),
      commonjsExternals({ externals: commonjsPackages }),
      react({
        fastRefresh: __DEV__,
        jsxRuntime: 'automatic',
        babel: {
          plugins: [
            // We need to have these plugins installed in our dependencies
            ['@babel/plugin-proposal-decorators', { legacy: true }],
            ['@babel/plugin-proposal-class-properties', { loose: true }],
          ],
        },
      }),
    ],
  };
});
