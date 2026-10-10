import { type ElectronApplication, expect, type Page } from '@playwright/test';

import { test } from '../../playwright/test';

const CURL_COMMAND = 'curl --request GET --url http://insomnia.rest/';
const isMac = process.platform === 'darwin';

// Blurs whatever holds focus so the next paste lands with no editable surface
// focused (the first-request input auto-focuses on empty projects).
const blurActiveElement = (page: Page) =>
  page.evaluate(() => (document.activeElement instanceof HTMLElement ? document.activeElement.blur() : undefined));

// Runs the real paste shortcut against the running app. Blurs first unless the
// caller wants the paste to land in a focused editor.
const pasteCurl = async (app: ElectronApplication, page: Page, { blur = true }: { blur?: boolean } = {}) => {
  await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), CURL_COMMAND);
  if (blur) {
    await blurActiveElement(page);
  }
  await page.keyboard.press(isMac ? 'Meta+v' : 'Control+v');
};

// Pasting a cURL while no editable surface has focus must start the import
// flow (INS-3544). The global paste listener lives in Root; these tests
// exercise the real keyboard shortcut against the running app.
test.describe('paste cURL import', () => {
  const waitForAppShell = async (page: Page) => {
    // The logged-in app shell has a banner; the scratchpad variant below
    // starts on the logged-out onboarding screen which has none.
    await page.getByRole('banner').waitFor();
  };

  test('pasting with no focused editor opens the Import modal with the cURL scanned', async ({ app, insomnia }) => {
    await waitForAppShell(insomnia.page);
    await pasteCurl(app, insomnia.page);

    // The modal auto-scans: assert the stable post-scan state (the pre-scan
    // form is replaced as soon as the scan result lands).
    await expect.soft(insomnia.page.getByRole('dialog')).toBeVisible();
    await expect.soft(insomnia.page.getByText('cURL resources to be imported:')).toBeVisible();
    await expect.soft(insomnia.page.getByText('1 Request')).toBeVisible();
  });

  test('pasting inside a workspace preselects the current collection', async ({ app, insomnia }) => {
    await waitForAppShell(insomnia.page);
    // The welcome card button creates a collection and navigates into it.
    await insomnia.page.getByRole('button', { name: 'Create request collection', exact: true }).click();
    await insomnia.page.waitForURL(/workspace\/[^/]+\/debug/);

    await pasteCurl(app, insomnia.page);

    await expect.soft(insomnia.page.getByText('cURL resources to be imported:')).toBeVisible();
    const collectionSelect = insomnia.page.getByLabel('Select API Collection');
    await expect.soft(collectionSelect).toBeVisible();
    const workspaceId = insomnia.page.url().match(/workspace\/([^/]+)/)?.[1] ?? '';
    expect.soft(workspaceId).toBeTruthy();
    // toHaveValue polls, so a preselect landing a frame later is still caught.
    await expect.soft(collectionSelect).toHaveValue(workspaceId);
  });

  test('pasting with the URL bar focused opens the Paste Curl modal instead', async ({ app, insomnia }) => {
    await waitForAppShell(insomnia.page);
    await insomnia.page.getByRole('button', { name: 'Create request collection', exact: true }).click();
    await insomnia.page.waitForURL(/workspace\/[^/]+\/debug/);

    // Focus a real editable surface: the URL bar is the main regression risk
    // because its own paste handler shows the Paste Curl modal.
    await insomnia.page.getByTestId('request-pane').getByTestId('OneLineEditor').first().click();
    await pasteCurl(app, insomnia.page, { blur: false });

    await expect.soft(insomnia.page.getByText('Paste Curl to import request')).toBeVisible();
    // The global import flow must not have started alongside it.
    await expect.soft(insomnia.page.getByText('cURL resources to be imported:')).toHaveCount(0);
  });

  test('pasting with no projects offers creating a new project in the Import modal', async ({ app, insomnia }) => {
    await waitForAppShell(insomnia.page);
    // The app auto-redirects to the first project while one exists, so reach
    // the genuine no-project state by deleting the only project.
    await insomnia.navigationSidebar.selectProjectDropdownOption({
      projectName: 'Personal Workspace',
      actionName: 'Delete',
    });
    await insomnia.page.getByRole('button', { name: 'Delete' }).click();
    await insomnia.page.waitForURL(/organization\/[^/]+\/project$/, { timeout: 15_000 });

    await pasteCurl(app, insomnia.page);

    await expect.soft(insomnia.page.getByText('cURL resources to be imported:')).toBeVisible();
    // Without a project in context the form defaults to creating a new one.
    await expect.soft(insomnia.page.getByLabel('Select Project')).toHaveValue('');
    await expect.soft(insomnia.page.getByRole('dialog').getByPlaceholder('Enter project name')).toBeVisible();
  });

  // Fresh data dir + no session makes the app open in the Scratchpad (the
  // logged-in app redirects away from scratchpad routes, so this is the only
  // way to exercise the real scratchpad context).
  const scratchpadTest = test.extend({
    userConfig: async ({ userConfig }, use) => {
      await use({ ...userConfig, session: undefined });
    },
  });

  scratchpadTest('pasting inside the Scratchpad does not trigger the import flow', async ({ app, insomnia }) => {
    await insomnia.page.getByRole('button', { name: 'Use local Scratch Pad' }).click();
    await insomnia.page.waitForURL(/proj_scratchpad/);

    await pasteCurl(app, insomnia.page);

    // The Scratchpad holds a single collection: the import flow must stay out
    // of it. Negative integration assertion: nothing is emitted when the flow
    // is disabled, so there is no event to await — poll a bounded window for
    // the modal's absence instead of sleeping.
    await expect
      .poll(() => insomnia.page.getByRole('dialog').count(), { timeout: 2000, intervals: [250, 250, 250, 250] })
      .toBe(0);
  });
});
