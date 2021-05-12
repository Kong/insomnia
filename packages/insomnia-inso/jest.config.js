/** @type { import('@jest/types').Config.InitialOptions } */
module.exports = {
  preset: '../../jest-preset.js',
  collectCoverage: true,
  coveragePathIgnorePatterns: ['/node_modules/'],
  coverageThreshold: {
    global: {
      branches: 88,
      functions: 96,
      lines: 95,
      statements: 95,
    },
  },
  setupFiles: ['./src/jest/setup.ts'],
};
