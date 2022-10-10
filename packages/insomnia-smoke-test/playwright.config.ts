/* eslint-disable filenames/match-exported */
import { PlaywrightTestConfig } from '@playwright/test';
const config: PlaywrightTestConfig = {
  projects: [
    {
      // Run all tests
      name: 'Default',
      testMatch: /.*.test.ts/,
      retries: 0,
    },
    {
      // High-confidence smoke/sanity checks
      name: 'Smoke',
      testMatch: /smoke\/.*.test.ts/,
      retries: 0,
    },
  ],
  webServer: {
    command: 'npm run serve',
    url: 'http://127.0.0.1:4010',
    timeout: 120 * 1000,
    reuseExistingServer: !process.env.CI,
  },
  use: {
    trace: {
      mode: 'retain-on-failure',
      screenshots: true,
      snapshots: true,
    },
  },
  reporter: process.env.CI ? 'github' : 'list',
  timeout: process.env.CI ? 60 * 1000 : 20 * 1000,
  forbidOnly: !!process.env.CI,
  outputDir: 'screenshots',
  testDir: 'tests',
  expect: {
    timeout: process.env.CI ? 25 * 1000 : 10 * 1000,
  },
  workers: process.env.CI ? 1 : undefined,
};
export default config;
