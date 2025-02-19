/* eslint-disable filenames/match-exported */
import { PlaywrightTestConfig } from '@playwright/test';
const config: PlaywrightTestConfig = {
  projects: [
    {
      // High-confidence smoke/sanity checks, runs on Test App only on Ubuntu
      name: 'Smoke',
      testMatch: /smoke\/.*.test.ts/,
      retries: 0,
    },
    {
      // Single critical path test, runs on release recurring
      name: 'Critical',
      testMatch: /critical\/.*.test.ts/,
      retries: 0,
    },
    {
      // Single critical path test, runs on release recurring
      name: 'Migration',
      testMatch: /migration\/.*.test.ts/,
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
    permissions: ['clipboard-read'],
  },
  reporter: process.env.CI ? 'github' : 'list',
  timeout: process.env.CI ? 60 * 1000 : 20 * 1000,
  forbidOnly: !!process.env.CI,
  outputDir: 'traces',
  testDir: 'tests',
  expect: {
    timeout: process.env.CI ? 25 * 1000 : 10 * 1000,
  },
  workers: 1,
};
export default config;
