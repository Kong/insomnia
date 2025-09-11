import { builtinModules } from 'node:module';
import path from 'node:path';

import { reactRouter } from '@react-router/dev/vite';
import { defineConfig } from 'vite';

import pkg from './package.json';
import { electronNodeRequire } from './vite-plugin-electron-node-require';
//These will be excluded from the bundle and remain as runtime dependencies
export const externalDependencies = [
  '@apideck/better-ajv-errors',
  '@apidevtools/swagger-parser',
  '@bufbuild/protobuf',
  '@connectrpc/connect',
  '@connectrpc/connect-node',
  '@getinsomnia/node-libcurl',
  '@grpc/grpc-js',
  '@grpc/proto-loader',
  '@seald-io/nedb',
  '@segment/analytics-node',
  '@stoplight/spectral-core',
  '@stoplight/spectral-formats',
  '@stoplight/spectral-ruleset-bundler',
  '@stoplight/spectral-rulesets',
  'apiconnect-wsdl',
  'aws4',
  'chai',
  'chai-json-schema',
  'chardet',
  'clone',
  'color',
  'content-disposition',
  'decompress',
  'dompurify',
  'electron-context-menu',
  'electron-updater',
  'fastq',
  'graphql',
  'graphql-ws',
  'grpc-reflection-js',
  'hawk',
  'hkdf',
  'hosted-git-info',
  'html-entities',
  'http-proxy-agent',
  'https-proxy-agent',
  'httpsnippet',
  'iconv-lite',
  'isbot',
  'js-yaml',
  'jsdom',
  'jshint',
  'jsonlint-mod-fixed',
  'marked',
  'mime-types',
  'mocha',
  'multiparty',
  'node-forge',
  'oauth-1.0a',
  'papaparse',
  'shell-quote',
  'socket.io-client',
  'swagger-ui-dist',
  'tough-cookie',
  'uuid',
  'yaml',
];
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
        external: [
          '@getinsomnia/node-libcurl',
          '@node-llama-cpp/mac-arm64-metal',
          '@node-llama-cpp/mac-x64',
          '@node-llama-cpp/linux-arm64',
          '@node-llama-cpp/linux-armv7l',
          '@node-llama-cpp/linux-x64',
          '@node-llama-cpp/linux-x64-cuda',
          '@node-llama-cpp/linux-x64-cuda-ext',
          '@node-llama-cpp/linux-x64-vulkan',
          '@node-llama-cpp/win-arm64',
          '@node-llama-cpp/win-x64',
          '@node-llama-cpp/win-x64-cuda',
          '@node-llama-cpp/win-x64-cuda-ext',
          '@node-llama-cpp/win-x64-vulkan',
          '@reflink/reflink-darwin-arm64',
          '@reflink/reflink-darwin-x64',
          '@reflink/reflink-linux-arm64-gnu',
          '@reflink/reflink-linux-arm64-musl',
          '@reflink/reflink-linux-x64-gnu',
          '@reflink/reflink-linux-x64-musl',
          '@reflink/reflink-win32-arm64-msvc',
          '@reflink/reflink-win32-x64-msvc',
        ],
      },
    },
    optimizeDeps: {
      exclude: [
        '@getinsomnia/node-libcurl',
        '@node-llama-cpp/mac-arm64-metal',
        '@node-llama-cpp/mac-x64',
        '@node-llama-cpp/linux-arm64',
        '@node-llama-cpp/linux-armv7l',
        '@node-llama-cpp/linux-x64',
        '@node-llama-cpp/linux-x64-cuda',
        '@node-llama-cpp/linux-x64-cuda-ext',
        '@node-llama-cpp/linux-x64-vulkan',
        '@node-llama-cpp/win-arm64',
        '@node-llama-cpp/win-x64',
        '@node-llama-cpp/win-x64-cuda',
        '@node-llama-cpp/win-x64-cuda-ext',
        '@node-llama-cpp/win-x64-vulkan',
        '@reflink/reflink-darwin-arm64',
        '@reflink/reflink-darwin-x64',
        '@reflink/reflink-linux-arm64-gnu',
        '@reflink/reflink-linux-arm64-musl',
        '@reflink/reflink-linux-x64-gnu',
        '@reflink/reflink-linux-x64-musl',
        '@reflink/reflink-win32-arm64-msvc',
        '@reflink/reflink-win32-x64-msvc',
      ],
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
    ],
    worker: {
      format: 'es',
    },
  };
});
