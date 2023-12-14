import { getFixturePath, loadFixture } from '../../playwright/paths';
import { test } from '../../playwright/test';

test('can send request with custom ca root certificate', async ({ app, page }) => {
  const text = await loadFixture('smoke-test-collection.yaml');
  await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);

  await page.getByRole('button', { name: 'Create in project' }).click();
  await page.getByRole('menuitemradio', { name: 'Import' }).click();
  await page.locator('[data-test-id="import-from-clipboard"]').click();
  await page.getByRole('button', { name: 'Scan' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();
  await page.getByText('CollectionSmoke testsjust now').click();

  await page.getByLabel('Request Collection').getByTestId('sends request with certs').press('Enter');

  await page.getByRole('button', { name: 'Send' }).click();
  await page.getByText('Error: SSL peer certificate or SSH remote key was not OK').click();

  // add server and client certs
  await page.getByTestId('workspace-context-dropdown').click();
  await page.getByRole('menuitemradio', { name: 'Settings' }).click();
  const workspaceId = await page.getByTestId('workspace-id').textContent();
  const fixturePath = getFixturePath('certificates');
  await page.evaluate(async ({ workspaceId, fixturePath }) => {
    window.main.database.caCertificate.create({
      parentId: workspaceId,
      path: fixturePath + '/rootCA.pem',
    });
  }, { workspaceId, fixturePath });
  await page.getByRole('button', { name: '' }).click();

  // test request with certs
  await page.getByRole('button', { name: 'Send' }).click();
  await page.getByText('200 OK').click();
  await page.locator('pre').filter({ hasText: '"id": "1"' }).click();
});
