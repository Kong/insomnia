/* eslint-disable filenames/match-exported */
import { PlaywrightTestConfig } from '@playwright/test';
const config: PlaywrightTestConfig = {
  webServer: {
    command: 'npm run serve',
    port: 4010,
    timeout: 120 * 1000,
    reuseExistingServer: !process.env.CI,
  },
  timeout: 20 * 1000, // @TODO: shorten this after we fix the 5 second app start delay
  forbidOnly: !!process.env.CI,
  outputDir: 'screenshots',
  testDir: 'specs',
};
export default config;
