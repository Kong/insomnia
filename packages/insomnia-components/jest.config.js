/** @type { import('@jest/types').Config.InitialOptions } */
module.exports = {
  preset: '../../jest-preset.js',
  globals: {
    'ts-jest': {
      isolatedModules: true,
    },
  },
  setupFilesAfterEnv: ['./src/jest/setup-after-env.ts'],
  testEnvironment: 'jsdom',
};
