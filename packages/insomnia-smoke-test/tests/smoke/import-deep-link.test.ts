import type { ElectronApplication } from '@playwright/test';
import { expect } from '@playwright/test';

import { test } from '../../playwright/test';

// OS-level deep links can't be tested in CI: protocol registration is
// machine-global and macOS delivery needs a packaged, protocol-registered
// build. Instead, tests send the `shell:open` IPC directly to the app's
// windows — the same channel the main process uses for real deep links —
// exercising the renderer deep-link handler in root.tsx → ImportModal with
// zero production-code changes. The main-process protocol hop is covered by
// manual testing.
const sendDeepLink = (app: ElectronApplication, url: string) =>
  app.evaluate(({ BrowserWindow }, deepLinkUrl) => {
    // Send outside evaluate()'s synchronous context. Only the main window has
    // a `shell:open` listener; sending to the others is a harmless no-op.
    setImmediate(() => {
      BrowserWindow.getAllWindows().forEach(window => {
        window.webContents.send('shell:open', deepLinkUrl);
      });
    });
  }, url);

test.describe('import deep links', () => {
  test.beforeEach(async ({ insomnia }) => {
    // `webContents.send` drops the event if the renderer's `shell:open`
    // listener (registered in Root) isn't up yet, so wait for the app shell.
    await insomnia.page.getByRole('banner').waitFor();
  });

  test('bare clipboard param opens the Import modal on the Clipboard tab', async ({ app, insomnia }) => {
    await sendDeepLink(app, 'insomnia://app/import?clipboard');

    await expect.soft(insomnia.page.getByLabel('Import from')).toBeVisible();
    // The app uses the non-standard `data-test-id` attribute (see playwright/pages).
    await expect.soft(insomnia.page.locator('[data-test-id="import-from-clipboard"]')).toBeVisible();
    await expect.soft(insomnia.page.locator('input[name="source"][value="clipboard"]')).toBeChecked();
  });

  test('bare curl param selects the cURL tab with an empty input and no error', async ({ app, insomnia }) => {
    // Param names are case-insensitive.
    await sendDeepLink(app, 'insomnia://app/import?CuRl');

    await expect.soft(insomnia.page.getByLabel('Import from')).toBeVisible();
    const curlInput = insomnia.page.locator('textarea[name="curl"]');
    await expect.soft(curlInput).toBeVisible();
    await expect.soft(curlInput).toHaveValue('');
    // Empty pre-populated value must not surface the invalid-curl error.
    await expect.soft(insomnia.page.getByText('Invalid cURL request')).toHaveCount(0);
  });

  test('value-bearing curl param pre-populates the cURL tab', async ({ app, insomnia }) => {
    const curlCommand = 'curl --request GET --url http://insomnia.rest/';
    await sendDeepLink(app, `insomnia://app/import?curl=${encodeURIComponent(curlCommand)}`);

    await expect.soft(insomnia.page.getByRole('dialog')).toBeVisible();
    // A value-bearing param auto-scans: the modal skips the source picker and
    // shows the detected resources ready to import.
    await expect.soft(insomnia.page.getByText('http://insomnia.rest/')).toBeVisible();
  });
});
