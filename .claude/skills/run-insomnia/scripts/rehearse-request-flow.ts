/**
 * Rehearsal for the "send a request, read the response" demo.
 *
 * Runs the whole script at full speed to prove every step resolves before a
 * human is asked to watch it. Prints what each demo step will need, so a broken
 * selector shows up here rather than mid-demo.
 */
import type { ElectronApplication, Page } from '@playwright/test';

import { InsomniaApp } from '@repo/packages/insomnia-smoke-test/playwright/pages';

interface Ctx {
  page: Page;
  app: ElectronApplication;
  expect: typeof import('@playwright/test').expect;
  log: (...xs: unknown[]) => void;
}

export default async ({ page, app, expect, log }: Ctx) => {
  const insomnia = new InsomniaApp(page, app);

  await insomnia.projectPage.importFixture('smoke-test-collection.yaml');
  log('step 1 ok - fixture imported');

  await insomnia.navigationSidebar.clickRequestOrFolder('send JSON request');
  const urlBar = page.getByTestId('request-pane').getByTestId('OneLineEditor').first();
  await expect(urlBar).toContainText('127.0.0.1:4010/pets/1');
  log('step 2 ok - request selected, url is', (await urlBar.innerText()).trim());

  const sendButton = page.getByTestId('request-pane').getByRole('button', { name: 'Send' });
  await expect(sendButton).toBeVisible();
  await sendButton.click();
  log('step 3 ok - Send clicked');

  const statusTag = page.getByTestId('response-pane').getByTestId('response-status-tag');
  await expect(statusTag).toContainText('200 OK');
  log('step 4 ok - status is', (await statusTag.innerText()).trim());

  const preview = page.getByRole('button', { name: 'Preview' });
  await expect(preview).toBeVisible();
  await preview.click();
  await page.getByRole('menuitem', { name: 'Raw Data' }).click();
  const body = page.locator('[data-testid="response-pane"] >> [data-testid="CodeEditor"]:visible');
  await expect(body).toContainText('{"id":"1"}');
  log('step 5 ok - raw body is', (await body.innerText()).trim());

  const consoleTab = page.getByTestId('response-pane').getByRole('tab', { name: 'Console' });
  await expect(consoleTab).toBeVisible();
  await consoleTab.click();
  const timeline = page.getByTestId('response-pane');
  await expect(timeline).toContainText('Preparing request to');
  log('step 6 ok - console/timeline shows the raw exchange');

  return { rehearsed: true, steps: 6 };
};
