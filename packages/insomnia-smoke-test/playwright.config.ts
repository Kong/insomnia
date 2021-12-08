import { PlaywrightTestConfig } from '@playwright/test';
const config: PlaywrightTestConfig = {
  webServer: {
    command: 'npm run serve',
    port: 4010,
    timeout: 120 * 1000,
    reuseExistingServer: !process.env.CI,
  },
};
export default config;
