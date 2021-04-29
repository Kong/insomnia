'use strict';

// @ts-check
/** @type { import('@jest/types').Config.InitialOptions } */
module.exports = {
  globals: {
    'ts-jest': {
      isolatedModules: true,
    },
  },
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  setupFilesAfterEnv: ['./src/jest/setup-after-env.ts'],
  verbose: false,
  resetMocks: true,
  resetModules: true,
  testRegex: ['.+\\.test\\.tsx?$'],
  collectCoverage: false,
  collectCoverageFrom: ['src/**/*.{js,jsx,ts,tsx}'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  coverageReporters: ['text-summary', 'lcov'],
};
