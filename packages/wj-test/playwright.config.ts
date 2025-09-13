import type { PlaywrightTestConfig } from '@playwright/test';

const config: PlaywrightTestConfig = {
  projects: [
    {
      // For WJ testing
      name: 'WJTest',
      testMatch: /.*.test.ts/,
      retries: 0,
    },
  ],
  use: {
    trace: {
      mode: 'retain-on-failure',
      screenshots: true,
      snapshots: true,
      sources: true,
    },
  },
  reporter: process.env.CI ? [['github'], ['line'], ['html', { outputFolder: 'report', open: 'never' }]] : [['list'], ['html', { outputFolder: 'report', open: 'never' }]],
  timeout: process.env.CI ? 60 * 1000 : 30 * 1000,
  forbidOnly: !!process.env.CI,
  outputDir: 'traces',
  testDir: './tests',
  expect: {
    timeout: process.env.CI ? 25 * 1000 : 15 * 1000,
  },
  workers: 1,
  globalTimeout: 20 * 60 * 1000,
};

export default config;
