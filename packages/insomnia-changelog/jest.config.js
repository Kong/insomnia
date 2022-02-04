/** @type { import('@jest/types').Config.InitialOptions } */
module.exports = {
  preset: '../../jest-preset.js',
  globals: {
    'ts-jest': {
      isolatedModules: false,
    },
  },
  collectCoverage: true,
  coverageThreshold: {
    global: {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
  },
};
