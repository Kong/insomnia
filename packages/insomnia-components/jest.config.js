/** @type { import('@jest/types').Config.InitialOptions } */
module.exports = {
  preset: '../../jest-preset.js',
  setupFilesAfterEnv: ['./src/jest/setup-after-env.ts'],
  testEnvironment: 'jsdom',
};
