/** @type { import('@jest/types').Config.InitialOptions } */
module.exports = {
  preset: '../../jest-preset.js',
  collectCoverage: false,
  coveragePathIgnorePatterns: ['/node_modules/'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 96,
      lines: 95,
      statements: 95,
    },
  },
};
