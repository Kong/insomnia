const path = require('node:path');

/** @type { import('@jest/types').Config.InitialOptions } */
module.exports = {
  moduleFileExtensions: [
    'js',
    'json',
    'jsx',
    'ts',
    'tsx',
  ],
  resetMocks: true,
  resetModules: true,
  testRegex: [
    '.+\\.test\\.tsx?$',
  ],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        isolatedModules: true,
      },
    ],
  },
  preset: 'ts-jest',
  cache: false,
  modulePathIgnorePatterns: ['./src/network/.*/__mocks__'],
  transformIgnorePatterns: ['/node_modules/(?!(@getinsomnia/api-client)/)'],
  setupFiles: ['./src/__jest__/setup.ts'],
  setupFilesAfterEnv: ['./src/__jest__/setup-after-env.ts'],
  testEnvironment: 'jsdom',
  verbose: false,
  moduleNameMapper: {
    '\\.(css|less|png|svg)$': '<rootDir>/src/__mocks__/dummy.ts',
    'styled-components': path.join(__dirname, '../../node_modules/styled-components'),
    'jsonpath-plus': path.join(__dirname, '../../node_modules/jsonpath-plus/dist/index-node-cjs.cjs'),
  },
};
