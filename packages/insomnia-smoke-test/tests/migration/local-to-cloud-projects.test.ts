import { copyFixtureDatabase } from '../../playwright/paths';
import { test } from '../../playwright/test';

const testWithLegacyDatabase = test.extend({
  dataPath: async ({ dataPath }, use) => {
    await copyFixtureDatabase('insomnia-legacy-db', dataPath);

    await use(dataPath);
  },
  userConfig: async ({ }, use) => {
    await use({
      skipOnboarding: true,
      publicKey: 'txb/w8DASTpPQqeHE/hpI3ABKzit+pv5n2We5dbtYRo=',
      secretKey: 'Tb1QKsI3wVZxhS8TuQESHB2x7f68PzeTzTMmLpnnFVU=',
    });
  },
});

testWithLegacyDatabase('Run data migration to version 8', async ({ app, page }) => {
  const code = 'BTxpIfgXY1VgUpoPpqA25RkCPGQ2MAkZsaY6IZ0bamd0WsYQlJM6iy8PV9hEHS1Gk96SBC6%2BM%2FGhv8IaVl1N6V5wdghHwU2sGKGkW%2Fevx1HiqAUsAqIry8aWRqAkc0n3KmW%2B%2F8lyeHCpy5jhsXqMMqXMbZh8dN1q%2ByRe2C6MJS1A706KbPUhI7PRi%2FsmK0TcNT7lgBKKHRVzPTvjpLcjgzSJFL4K%2BEzgY9Ue4gh0gPw89sM9dV%2F2sAlpw0LA7rF06NyoPhA%3D';

  const interceptBrowserLink = app.evaluate(electron => {
    return new Promise<void>(resolve => {
      const webContents = electron.BrowserWindow.getAllWindows()[0].webContents;
      // Remove all navigation listeners so that only the one we inject will run
      webContents.removeAllListeners('will-navigate');
      webContents.on('will-navigate', event => {
        event.preventDefault();
        resolve();
      });
    });
  });

  await Promise.all([
    interceptBrowserLink,
    page.getByLabel('Continue with Google').click(),
  ]);

  await page.locator('input[name="code"]').click();
  await page.locator('input[name="code"]').fill(code);

  await page.getByRole('button', { name: 'Log in' }).click();
  await page.getByLabel('Project 1').click();
  await page.getByLabel('Personal Workspace', { exact: true }).click();
  await page.getByRole('link', { name: '🦄' }).first().click();
  await page.getByRole('link', { name: '🦄' }).nth(1).click();
  await page.getByLabel('Personal Workspace', { exact: true }).click();
});
