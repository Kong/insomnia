// Read more about creating fixtures https://playwright.dev/docs/test-fixtures
import { ElectronApplication, test as baseTest, TraceMode } from '@playwright/test';
import path from 'path';

import {
  bundleType,
  cwd,
  executablePath,
  mainPath,
  randomDataPath,
} from './paths';

interface EnvOptions {
  INSOMNIA_DATA_PATH: string;
  INSOMNIA_API_URL: string;
  INSOMNIA_APP_WEBSITE_URL: string;
  INSOMNIA_GITHUB_API_URL: string;
  INSOMNIA_GITLAB_API_URL: string;
  INSOMNIA_UPDATES_URL: string;
}

export const test = baseTest.extend<{
  app: ElectronApplication;
  db: {
    stuff: string;
    onReady: () => Promise<unknown>;
  };
}>({
  app: async ({ playwright, trace, db }, use, testInfo) => {
    await db.onReady();
    console.log('Creating app');
    const webServerUrl = testInfo.config.webServer?.url;

    const options: EnvOptions = {
      INSOMNIA_DATA_PATH: randomDataPath(),
      INSOMNIA_API_URL: webServerUrl + '/api',
      INSOMNIA_APP_WEBSITE_URL: webServerUrl + '/website',
      INSOMNIA_GITHUB_API_URL: webServerUrl + '/github-api/graphql',
      INSOMNIA_GITLAB_API_URL: webServerUrl + '/gitlab-api',
      INSOMNIA_UPDATES_URL: webServerUrl || 'https://updates.insomnia.rest',
    };

    const electronApp = await playwright._electron.launch({
      cwd,
      executablePath,
      args: bundleType() === 'package' ? [] : [mainPath],
      env: {
        ...process.env,
        ...options,
        PLAYWRIGHT: 'true',
      },
    });

    const appContext = electronApp.context();
    const traceMode: TraceMode = typeof trace === 'string' ? trace as TraceMode : trace.mode;

    const defaultTraceOptions = { screenshots: true, snapshots: true, sources: true };
    const traceOptions = typeof trace === 'string' ? defaultTraceOptions : { ...defaultTraceOptions, ...trace, mode: undefined };
    const captureTrace = (traceMode === 'on' || traceMode === 'retain-on-failure' || (traceMode === 'on-first-retry' && testInfo.retry === 1));

    if (captureTrace) {
      await appContext.tracing.start(traceOptions);
    }

    await use(electronApp);

    if (captureTrace) {
      await appContext.tracing.stop({
        path: path.join(testInfo.outputDir, 'trace.zip'),
      });
    }

    await electronApp.close();
  },
  page: async ({ app }, use) => {
    const page = await app.firstWindow();

    await page.waitForLoadState();

    await use(page);
  },
  db: async ({ }, use) => {
    console.log('Creating db');
    const db = {
      stuff: 'here',
      onReady: () => new Promise(resolve => setTimeout(resolve, 1000)),
    };

    await use(db);

    console.log('Closing db');
  },
});
