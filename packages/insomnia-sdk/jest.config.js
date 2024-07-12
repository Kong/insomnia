/** @type { import('@jest/types').Config.InitialOptions } */

module.exports = {
  moduleFileExtensions: [
    'js',
    'json',
    'jsx',
    'node',
    'ts',
    'tsx',
  ],
  resetMocks: true,
  resetModules: true,
  testEnvironment: 'node',
  testRegex: [
    '.+\\.test\\.tsx?$',
  ],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        isolatedModules: false,
        tsconfig: '../../tsconfig.base.json',
      },
    ],
  },
  verbose: false,
  preset: 'ts-jest',
};
