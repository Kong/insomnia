// Read more about creating fixtures https://playwright.dev/docs/test-fixtures
import { ElectronApplication, Page, test as baseTest } from '@playwright/test';
import { platform } from 'os';

import {
  cwd,
  DESIGNER_DATA_PATH,
  executablePath,
  INSOMNIA_DATA_PATH,
  mainPath,
  randomDataPath,
} from './paths';

interface EnvOptions {
  INSOMNIA_DATA_PATH: string;
  DESIGNER_DATA_PATH?: string;
}

export const test = baseTest.extend<{
  app: ElectronApplication;
  appWithDesignerDataPath: ElectronApplication;
  pageWithDesignerDataPath: Page;
}>({
  app: async ({ playwright }, use) => {
    const options: EnvOptions = {
      INSOMNIA_DATA_PATH: randomDataPath(),
      DESIGNER_DATA_PATH: 'doesnt-exist',
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
  appWithDesignerDataPath: async ({ playwright }, use) => {
    const options: EnvOptions = {
      INSOMNIA_DATA_PATH,
      DESIGNER_DATA_PATH,
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
  pageWithDesignerDataPath: async ({ appWithDesignerDataPath }, use) => {
    const page = await appWithDesignerDataPath.firstWindow();

    if (process.platform === 'win32') await page.reload();

    await use(page);

    await page.close();
  },
});
