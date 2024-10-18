import { test } from '../../playwright/test';

test('Clone from generic Git server', async ({ page }) => {
  // waitting for the /features api request to finish
  await page.waitForSelector('[data-test-git-enable="true"]');
  await page.getByLabel('Clone git repository').click();
  await page.getByRole('tab', { name: ' Git' }).click();
  await page.getByPlaceholder('https://github.com/org/repo.git').fill('https://github.com/Kong/insomnia-git-example.git');
  await page.getByPlaceholder('Name').fill('J');
  await page.getByPlaceholder('Email').fill('J');
  await page.getByPlaceholder('MyUser').fill('J');
  await page.getByPlaceholder('88e7ee63b254e4b0bf047559eafe86ba9dd49507').fill('J');
  await page.getByTestId('git-repository-settings-modal__sync-btn').click();
  await page.getByLabel('Toggle preview').click();
});

test('Sign in with GitHub', async ({ app, page }) => {
  await page.getByRole('button', { name: 'New Document' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Create' }).click();
  await page.getByLabel('Insomnia Sync').click();
  await page.getByRole('menuitemradio', { name: 'Switch to Git Repository' }).click();

  await page.getByRole('tab', { name: 'GitHub' }).click();

  // Prevent the app from opening the browser to the authorization page
  // and return the url that would be created by following the GitHub OAuth flow.
  // https://docs.github.com/en/developers/apps/building-oauth-apps/authorizing-oauth-apps#web-application-flow
  const fakeGitHubAppOAuthWebFlow = app.evaluate(electron => {
    return new Promise<{ redirectUrl: string }>(resolve => {
      const webContents = electron.BrowserWindow.getAllWindows()?.find(w => w.title === 'Insomnia')?.webContents;
      // Remove all navigation listeners so that only the one we inject will run
      webContents?.removeAllListeners('will-navigate');
      webContents?.on('will-navigate' as any, (event: Event, url: string) => {
        event.preventDefault();
        const parsedUrl = new URL(url);
        // We use the same state parameter that the app created to assert that we prevent CSRF
        const stateSearchParam = parsedUrl.searchParams.get('state') || '';
        const redirectUrl = `insomnia://oauth/github-app/authenticate?state=${stateSearchParam}&code=12345`;
        resolve({ redirectUrl });
      });
    });
  });

  const [{ redirectUrl }] = await Promise.all([
    fakeGitHubAppOAuthWebFlow,
    page.getByText('Authenticate with GitHub').click({
      // When playwright clicks a link it waits for navigation to finish.
      // In our case we are stubbing the navigation and we don't want to wait for it.
      noWaitAfter: true,
    }),
  ]);

  await page.locator('input[name="link"]').click();

  await page.locator('input[name="link"]').fill(redirectUrl);

  await page.getByRole('button', { name: 'Authenticate' }).click();

  await page.locator('button[id="github_repo_select_dropdown_button"]').click();

  await page.getByLabel('kong-test/sleepless').click();

  await page.locator('data-testid=git-repository-settings-modal__sync-btn').click();
});
