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
  testEnvironment: 'node',
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
  verbose: false,
  preset: 'ts-jest',
  setupFiles: ['./src/jest/setup.ts'],
};
