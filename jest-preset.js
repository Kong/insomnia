/** @type { import('@jest/types').Config.InitialOptions } */
module.exports = {
  collectCoverage: false,
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
      },
    ],
  },
  verbose: false,
  preset: 'ts-jest',
};
