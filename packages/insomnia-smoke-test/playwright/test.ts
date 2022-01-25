// Read more about creating fixtures https://playwright.dev/docs/test-fixtures
import { ElectronApplication, test as baseTest } from '@playwright/test';
import { platform } from 'os';

import {
  cwd,
  executablePath,
  mainPath,
  randomDataPath,
} from './paths';

interface EnvOptions {
  INSOMNIA_DATA_PATH: string;
}

export const test = baseTest.extend<{
  app: ElectronApplication;
}>({
  app: async ({ playwright }, use) => {
    const options: EnvOptions = {
      INSOMNIA_DATA_PATH: randomDataPath(),
    };

    const electronApp = await playwright._electron.launch({
      cwd,
      executablePath,
      args: process.env.BUNDLE === 'package' ? [] : [mainPath],
      env: {
        ...process.env,
        ...options,
        PLAYWRIGHT: 'true',
      },
    });

    await use(electronApp);

    // Closing the window (page) doesn't close the app on osx
    if (platform() === 'darwin') {
      await electronApp.close();
    }
  },
  page: async ({ app }, use) => {
    const page = await app.firstWindow();

    if (process.platform === 'win32') await page.reload();

    await page.click("text=Don't share usage analytics");

    await use(page);

    await page.close();
  },
});
