import { expect } from '@playwright/test';

import { test } from '../../playwright/test';

test('can send ipv6 requests', async ({ page, insomnia }) => {
  test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');

  const statusTag = page.locator('[data-testid="response-status-tag"]:visible');
  const responseBody = page.getByTestId('response-pane');

  await insomnia.projectPage.importFixture('ipv6-collection.yaml');

  await page.getByLabel('Request Collection')
    .getByTestId('send JSON request').press('Enter');
  await expect.soft(page.getByTestId('request-pane')
    .getByTestId('OneLineEditor')
    .getByText('http://[::1]:4010/pets/1')
  ).toBeVisible();

  await page.getByTestId('request-pane')
    .getByRole('button', { name: 'Send' }).click();
  await expect.soft(statusTag).toContainText('200 OK');
  await expect.soft(responseBody).toContainText('"id": "1"');

  await page
    .getByLabel('Request Collection')
    .getByTestId('sends dummy.csv request and shows rich response')
    .press('Enter');
  await expect.soft(page.getByTestId('request-pane')
    .getByTestId('OneLineEditor')
    .getByText('http://[::1]:4010/file/dummy.csv')
  ).toBeVisible();

  await page.getByTestId('request-pane')
    .getByRole('button', { name: 'Send' }).click();
  await expect.soft(statusTag).toContainText('200 OK');
  await page.getByRole('button', { name: 'Preview' }).click();
  await page.getByRole('menuitem', { name: 'Raw Data' }).click();
  await expect.soft(responseBody).toContainText('a,b,c');
});
