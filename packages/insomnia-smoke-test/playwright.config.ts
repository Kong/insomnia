/* eslint-disable filenames/match-exported */
import { PlaywrightTestConfig } from '@playwright/test';
const config: PlaywrightTestConfig = {
  webServer: {
    command: 'npm run serve',
    port: 4010,
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
  workers: process.env.CI ? 2 : 4,
};
export default config;
