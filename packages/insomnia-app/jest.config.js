/** @type { import('@jest/types').Config.InitialOptions } */
module.exports = {
  globals: {
    'ts-jest': {
      isolatedModules: true,
    },
  },
  testEnvironment: 'jsdom',
  cache: false,
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  verbose: true,
  resetMocks: true,
  resetModules: true,
  testRegex: ['.+\\.test\\.tsx?$'],
  collectCoverage: false,
  collectCoverageFrom: ['app/**/*.{js,jsx,ts,tsx}'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  coverageReporters: ['text-summary', 'lcov'],
  setupFiles: [
    './__jest__/setup.ts',
  ],
  setupFilesAfterEnv: [
    './__jest__/setup-after-env.ts',
  ],
  moduleNameMapper: {
    '\\.(css|less|png)$': '<rootDir>/__mocks__/dummy.ts',
    '^worker-loader!': '<rootDir>/__mocks__/dummy.ts',
  },
  modulePathIgnorePatterns: [
    '<rootDir>/network/.*/__mocks__',
  ],
  rootDir: 'app',
};
