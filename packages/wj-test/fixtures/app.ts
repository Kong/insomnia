/* eslint-disable no-empty-pattern */
// Read more about creating fixtures https://playwright.dev/docs/test-fixtures
import path from 'node:path';

import type { ElectronApplication, TraceMode } from '@playwright/test';
import { test as base } from '@playwright/test';

import { bundleType, cwd, executablePath, mainPath, randomDataPath } from './paths';


interface EnvOptions {
  INSOMNIA_DATA_PATH: string;
  INSOMNIA_API_URL: string;
  INSOMNIA_APP_WEBSITE_URL: string;
  INSOMNIA_AI_URL: string;
  INSOMNIA_MOCK_API_URL: string;
  INSOMNIA_GITHUB_REST_API_URL: string;
  INSOMNIA_GITHUB_API_URL: string;
  INSOMNIA_GITLAB_API_URL: string;
  INSOMNIA_UPDATES_URL: string;
  INSOMNIA_SKIP_ONBOARDING: string;
  INSOMNIA_PUBLIC_KEY: string;
  INSOMNIA_SECRET_KEY: string;
  INSOMNIA_SESSION?: string;
  INSOMNIA_VAULT_KEY: string;
  INSOMNIA_VAULT_SALT: string;
  INSOMNIA_VAULT_SRP_SECRET: string;
}

export const test = base.extend<{
  app: ElectronApplication;
}>({
  app: async ({ playwright, trace }, use, testInfo) => {
    const options: EnvOptions = {
      INSOMNIA_DATA_PATH: randomDataPath(),
      INSOMNIA_API_URL: '',
      INSOMNIA_APP_WEBSITE_URL: '',
      INSOMNIA_AI_URL: '',
      INSOMNIA_GITHUB_REST_API_URL: '',
      INSOMNIA_GITHUB_API_URL: '',
      INSOMNIA_GITLAB_API_URL: '',
      INSOMNIA_UPDATES_URL: 'https://updates.insomnia.rest',
      INSOMNIA_MOCK_API_URL: 'https://mock-stage.insomnia.run',
      INSOMNIA_SKIP_ONBOARDING: 'true',
      INSOMNIA_PUBLIC_KEY: '',
      INSOMNIA_SECRET_KEY: '',
      INSOMNIA_VAULT_KEY: '',
      INSOMNIA_VAULT_SALT: '',
      INSOMNIA_VAULT_SRP_SECRET: '',
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

    const traceMode: TraceMode = typeof trace === 'string' ? (trace as TraceMode) : trace.mode;

    const defaultTraceOptions = { screenshots: true, snapshots: true, sources: true };
    const traceOptions =
      typeof trace === 'string' ? defaultTraceOptions : { ...defaultTraceOptions, ...trace, mode: undefined };
    const captureTrace =
      traceMode === 'on' ||
      traceMode === 'retain-on-failure' ||
      (traceMode === 'on-first-retry' && testInfo.retry === 1);

    if (captureTrace) {
      await appContext.tracing.start(traceOptions);
    }

    let testFailed = false;
    try {
      await use(electronApp);
    } catch (error) {
      testFailed = true;
      throw error;
    } finally {
      // set testFailed to true if the test timed out or failed
      testFailed = testFailed || testInfo.status === 'timedOut' || testInfo.status === 'failed';
      if (
        traceMode === 'on' ||
        (traceMode === 'retain-on-failure' && testFailed) ||
        (traceMode === 'on-first-retry' && testInfo.retry === 1)
      ) {
        // Use a different name rather than the default trace.zip to avoid overwriting the trace.
        // Refer: https://github.com/microsoft/playwright/issues/35005
        await appContext.tracing.stop({
          path: path.join(testInfo.outputDir, `trace-${testInfo.title}-${testInfo.status}.zip`),
        });
      } else {
        // Discard the trace if not needed
        await appContext.tracing.stop();
      }
    }

    await electronApp.close();
  },

  page: async ({ app }, use) => {
    const page = await app.firstWindow();
    await page.waitForLoadState();

    await page.getByRole('button', { name: 'Use the Scratch Pad' }).click();

    await use(page);
  },

});
