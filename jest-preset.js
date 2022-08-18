/** @type { import('@jest/types').Config.InitialOptions } */
module.exports = {
  collectCoverage: false,
  globals: {
    'ts-jest': {
      isolatedModules: false,
    },
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  resetMocks: true,
  resetModules: true,
  testEnvironment: 'node',
  modulePathIgnorePatterns : [
    'insomnia-smoke-test/tests/',
    'insomnia-smoke-test/cli/',
  ],
  testRegex: ['.+\\.test\\.tsx?$'],
  transform: { '^.+\\.tsx?$': 'ts-jest' },
  verbose: false,
};
