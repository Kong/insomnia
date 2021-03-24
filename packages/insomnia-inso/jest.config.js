'use strict';

// @ts-check
module.exports = /** @type { import('@jest/types').Config.InitialOptions } */ {
  globals: {
    'ts-jest': {
      isolatedModules: true,
    },
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  testMatch: [
    '**/*.test.ts',
  ],
  verbose: false,
  resetMocks: true,
  resetModules: true,

  setupFiles: [
    './src/jest/setup.ts',
  ],
  collectCoverage: true,
  coveragePathIgnorePatterns: [
    '/node_modules/',
  ],
  coverageThreshold: {
    global: {
      branches: 88,
      functions: 96,
      lines: 95,
      statements: 95,
    },
  },
};
