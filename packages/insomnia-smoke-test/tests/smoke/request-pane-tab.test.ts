import { expect } from '@playwright/test';

import { test } from '../../playwright/test';

test('Request tabs', async ({ page }) => {
  // Create new collection
  await page.getByRole('button', { name: 'Create request collection', exact: true }).click();

  await page.getByRole('tab', { name: 'Body' }).click();
  await page.getByRole('button', { name: 'Body' }).click();
  await page.getByRole('option', { name: 'JSON' }).click();
  await page.getByRole('tab', { name: 'Auth' }).click();
  await page.getByRole('button', { name: 'Auth' }).click();
  await page.getByLabel('OAuth 1.0', { exact: true }).click();
  await page.getByRole('tab', { name: 'Params' }).click();
  await page.getByRole('tab', { name: 'Headers' }).click();
  await page.getByRole('tab', { name: 'Docs' }).click();
  await page.getByTestId('CodeEditor').getByRole('textbox').fill('some docs');
  await page.getByRole('tab', { name: 'Preview' }).click();
});

test('WS tabs', async ({ page, insomnia }) => {
  // Create new collection
  await page.getByRole('button', { name: 'Create request collection', exact: true }).click();

  await insomnia.navigationSidebar.openWorkspaceActionsDropdown('My first collection');
  await page.getByRole('menuitemradio', { name: 'WebSocket Request' }).click();
  // ensure that the websocket request is created
  await insomnia.navigationSidebar.clickRequestOrFolder('New WebSocket Request');
  await page.getByRole('tab', { name: 'Body' }).click();
  await page.getByRole('button', { name: 'JSON' }).click();
  await page.getByRole('option', { name: 'JSON' }).click();
  await page.getByRole('tab', { name: 'Auth' }).click();
  await page.getByRole('tab', { name: 'Params' }).click();
  await page.getByRole('tab', { name: 'Headers' }).click();
  await page.getByRole('tab', { name: 'Docs' }).click();
  await page.getByTestId('CodeEditor').getByRole('textbox').fill('some docs');
  await page.getByRole('tab', { name: 'Preview' }).click();
});
