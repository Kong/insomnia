import { ElectronApplication, Page, test, TraceMode } from '@playwright/test';
import path from 'path';

import { bundleType, cwd, executablePath, mainPath, randomDataPath } from '../playwright/paths';

interface EnvOptions {
  INSOMNIA_DATA_PATH: string;
  INSOMNIA_API_URL: string;
  INSOMNIA_APP_WEBSITE_URL: string;
  INSOMNIA_GITHUB_API_URL: string;
  INSOMNIA_GITLAB_API_URL: string;
}

test.describe.serial('GitLab Sync: Success Path', () => {
  let electronApp: ElectronApplication;
  let page: Page;

  test.beforeAll(async ({ playwright, trace }, testInfo) => {
    // @TODO: move this to a helper function
    // This way was done because it seemed we needed to run tests continuously
    const webServerUrl = testInfo.config.webServer?.url;

    const options: EnvOptions = {
      INSOMNIA_DATA_PATH: randomDataPath(),
      INSOMNIA_API_URL: webServerUrl + '/api',
      INSOMNIA_APP_WEBSITE_URL: webServerUrl + '/website',
      INSOMNIA_GITHUB_API_URL: webServerUrl + '/github-api/graphql',
      INSOMNIA_GITLAB_API_URL: webServerUrl + '/gitlab-api',
    };

    electronApp = electronApp ? electronApp : await playwright._electron.launch({
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

    if (captureTrace) {
      await appContext.tracing.stop({
        path: path.join(testInfo.outputDir, 'trace.zip'),
      });
    }

    page = await electronApp.firstWindow();
    await page.waitForLoadState();
    await page.click("text=Don't share usage analytics");
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('can authenticate with GitLab', async () => {
    const btnGitSync = page.locator('text=Setup Git Sync');
    await btnGitSync.click();

    const btnRepoSettings = await page.locator('button:has-text("Repository Settings")');
    await btnRepoSettings.click();

    const btnGitLabTab = await page.locator('li[role="tab"]:has-text("GitLab")');
    await btnGitLabTab.click();

    const fakeGitHubOAuthWebFlow = electronApp.evaluate(electron => {
      return new Promise<{ redirectUrl: string }>(resolve => {
        const webContents = electron.BrowserWindow.getAllWindows()[0].webContents;
        // Remove all navigation listeners so that only the one we inject will run
        webContents.removeAllListeners('will-navigate');
        webContents.on('will-navigate', (e, url) => {
          e.preventDefault();
          const parsedUrl = new URL(url);
          // We use the same state parameter that the app created to assert that we prevent CSRF
          const stateSearchParam = parsedUrl.searchParams.get('state') || '';
          const redirectUrl = `insomnia://oauth/gitlab/authenticate?code=12345&state=${stateSearchParam}`;
          resolve({ redirectUrl });
        });
      });
    });

    const [{ redirectUrl }] = await Promise.all([
      fakeGitHubOAuthWebFlow,
      page.locator('text=Authenticate with GitLab').click({
        // When playwright clicks a link it waits for navigation to finish.
        // In our case we are stubbing the navigation and we don't want to wait for it.
        noWaitAfter: true,
      }),
    ]);

    await page.locator('input[name="link"]').click();
    await page.locator('input[name="link"]').fill(redirectUrl);
    await page.locator('button[name="add-token"]').click();

    test.expect(await page.locator('text="Mark Kim"')).toBeTruthy();
    test.expect(await page.locator('button[name="sign-out"]')).toBeTruthy();
  });

  test('can clone a repository from GitLab', async () => {
    await page
      .locator('input[name="uri"]')
      .fill('https://gitlab.com/i3801/newnewnew.git');

    await page.locator('button[name="done"]').click();
  });

  // test('can sign out', async ({ app, page }) => {});
  // test('can push', async ({ app, page }) => {});
  // test('can commit', async ({ app, page }) => {});
  // test('can pull', async ({ app, page }) => {});
  // test('can check history', async ({ app, page }) => {});
});
