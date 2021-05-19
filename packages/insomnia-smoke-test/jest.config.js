/** @type { import('@jest/types').Config.InitialOptions } */
module.exports = {
  preset: '../../jest-preset.js',
  setupFilesAfterEnv: [
    './__jest__/setup.ts',
  ],
};
