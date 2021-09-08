/** @type { import('@jest/types').Config.InitialOptions } */
module.exports = {
  // preset: '../../jest-preset.js', // DOES NOT WORK
  // same as preset:
  collectCoverage: false,
  globals: {
    'ts-jest': {
      isolatedModules: true,
    },
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  resetMocks: true,
  resetModules: true,
  testRegex: ['.+\\.test\\.tsx?$'],
  transform: { '^.+\\.tsx?$': 'ts-jest' },

  // extended from preset:
  cache: false,
  modulePathIgnorePatterns: ['<rootDir>/network/.*/__mocks__'],
  rootDir: 'app',
  setupFiles: ['./__jest__/setup.ts'],
  setupFilesAfterEnv: ['./__jest__/setup-after-env.ts'],
  testEnvironment: 'jsdom',
  verbose: true,
  moduleNameMapper: {
    '\\.(css|less|png)$': '<rootDir>/__mocks__/dummy.ts',
    '^worker-loader!': '<rootDir>/__mocks__/dummy.ts',
  },
};
