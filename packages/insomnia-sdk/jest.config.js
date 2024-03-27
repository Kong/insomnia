// const path = require('node:path');

/** @type { import('@jest/types').Config.InitialOptions } */
module.exports = {
  preset: '../../jest-preset.js',
  globals: {
    'ts-jest': {
      isolatedModules: true,
    },
  },
  cache: false,
  modulePathIgnorePatterns: [],
  transformIgnorePatterns: [],
  setupFiles: [
    // '../insomnia/src/__jest__/setup.ts'
  ],
  setupFilesAfterEnv: [
    // '../insomnia/src/__jest__/setup-after-env.ts'
  ],
  testEnvironment: 'jsdom',
  verbose: true,
  moduleNameMapper: {
    // '\\.(css|less|png|svg)$': '<rootDir>/src/__mocks__/dummy.ts',
    // 'styled-components': path.join(__dirname, '../../node_modules/styled-components'),
    // 'jsonpath-plus': path.join(__dirname, '../../node_modules/jsonpath-plus/dist/index-node-cjs.cjs'),
    'uuid': require.resolve('uuid'),
  },
  collectCoverage: !!process.env.CI,
  // collectCoverageFrom: ['src/account/**/*.ts', 'src/common/**/*.ts', 'src/main/**/*.ts', 'src/models/**/*.ts', 'src/network/**/*.ts', 'src/sync/**/*.ts', 'src/templating/**/*.ts', 'src/utils/**/*.ts'],
  coverageThreshold: {
    global: {
      lines: 35,
    },
  },
};
