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
        tsconfig: 'tsconfig.jest.json',
      },
    ],
  },
  preset: 'ts-jest',
};
