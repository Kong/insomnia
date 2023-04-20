/** @type { import('@jest/types').Config.InitialOptions } */
module.exports = {
  preset: '../../jest-preset.js',
  globals: {
    'ts-jest': {
      isolatedModules: true,
    },
  },
  cache: false,
  modulePathIgnorePatterns: ['./src/network/.*/__mocks__'],
  transformIgnorePatterns: ['/node_modules/(?!(@getinsomnia/api-client)/)'],
  setupFiles: ['./src/__jest__/setup.ts'],
  setupFilesAfterEnv: ['./src/__jest__/setup-after-env.ts'],
  testEnvironment: 'jsdom',
  verbose: true,
  moduleNameMapper: {
    '\\.(css|less|png|svg)$': '<rootDir>/src/__mocks__/dummy.ts',
    'styled-components': '<rootDir>/node_modules/styled-components',
    'jsonpath-plus': '<rootDir>/node_modules/jsonpath-plus/dist/index-node-cjs.cjs',
  },
  collectCoverage: true,
  collectCoverageFrom: ['src/account/**/*.ts', 'src/common/**/*.ts', 'src/main/**/*.ts', 'src/models/**/*.ts', 'src/network/**/*.ts', 'src/sync/**/*.ts', 'src/templating/**/*.ts', 'src/utils/**/*.ts'],
  coverageThreshold: {
    global: {
      lines: 35,
    },
  },
};
