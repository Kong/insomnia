import { ElectronApplication, Page } from '@playwright/test';

import { test } from '../playwright/test';

interface TestCallback {
  app: ElectronApplication;
  page: Page;
}

test.describe.serial('gitlab oauth', () => {
  test('can authenticate with GitLab', async ({ app, page }: TestCallback) => {
    const btnGitSync = page.locator('text=Setup Git Sync');
    await btnGitSync.click();

    const btnRepoSettings = await page.locator('button:has-text("Repository Settings")');
    await btnRepoSettings.click();

    const btnGitLabTab = await page.locator('li[role="tab"]:has-text("GitLab")');
    await btnGitLabTab.click();

    const fakeGitHubOAuthWebFlow = app.evaluate(electron => {
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

    // await page
    //   .locator('input[name="uri"]')
    //   .fill('https://gitlab.com/mark.kim1/insomnia-sync.git');
    //
  });

  test('can clone a repository from GitLab', async ({ app, page }: TestCallback) => {
    await page
      .locator('input[name="uri"]')
      .fill('https://gitlab.com/mark.kim1/insomnia-sync.git');
  });
});

// test('can sign out', async ({ app, page }) => {});
// test('can push', async ({ app, page }) => {});
// test('can commit', async ({ app, page }) => {});
// test('can pull', async ({ app, page }) => {});
// test('can check history', async ({ app, page }) => {});
