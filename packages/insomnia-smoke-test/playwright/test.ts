// Read more about creating fixtures https://playwright.dev/docs/test-fixtures
import { ElectronApplication, test as baseTest } from '@playwright/test';
import path from 'path';

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
  app: async ({ playwright }, use, testInfo) => {
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

    const appContext = electronApp.context();

    await appContext.tracing.start({
      title: testInfo.title,
      name: testInfo.title,
      screenshots: true,
      snapshots: true,
    });

    await use(electronApp);

    await appContext.tracing.stop({
      path: path.join(testInfo.outputDir, 'trace.zip'),
    });

    await electronApp.close();
  },
  page: async ({ app }, use) => {
    const page = await app.firstWindow();

    if (process.platform === 'win32') await page.reload();

    await page.click("text=Don't share usage analytics");

    await use(page);
  },
});
