import { expect } from '@playwright/test';

import { test } from '../../playwright/test';

const DEFAULT_REQUEST_NAME = 'New Request';

test.describe('multiple-tab feature test', () => {
  test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');

  test.beforeEach(async ({ page }) => {
    await page.getByLabel('Create in project').click();
    await page.getByLabel('Request collection', { exact: true }).click();
    await page.getByRole('button', { name: 'Create', exact: true }).click();
  });

  test('add tab & close tab', async ({ page }) => {
    await page.getByLabel('Create in collection').click();
    await page.getByLabel('HTTP Request').click();
    const tab = await page.getByLabel('Insomnia Tabs').getByLabel(`tab-${DEFAULT_REQUEST_NAME}`, { exact: true });
    expect(tab).toBeVisible();
    expect(await tab.getAttribute('data-selected')).toBe('true');
    await tab.getByRole('button').click();
    await expect(tab).toBeHidden();
  });

  test('active tab sync with the sidebar active request', async ({ page }) => {
    await page.getByLabel('Create in collection').click();
    await page.getByLabel('HTTP Request').click();
    await page.getByTestId('New Request').dblclick();
    await page.getByRole('textbox', { name: 'GET New Request' }).fill('New Request A');
    await page.getByLabel('Create in collection').click();
    await page.getByLabel('HTTP Request').click();
    await page.getByTestId('New Request').dblclick();
    await page.getByRole('textbox', { name: 'GET New Request' }).fill('New Request B');
    await page.getByTestId('New Request A').click();
    await page.waitForTimeout(1000);
    const tabA = await page.getByLabel('Insomnia Tabs').getByLabel('tab-New Request A', { exact: true });
    expect(await tabA.getAttribute('data-selected')).toBe('true');
    await page.getByTestId('New Request B').click();
    await page.waitForTimeout(1000);
    const tabB = await page.getByLabel('Insomnia Tabs').getByLabel('tab-New Request B', { exact: true });
    expect(await tabB.getAttribute('data-selected')).toBe('true');
  });

  test('close tab after delete a request', async ({ page }) => {
    await page.getByLabel('Create in collection').click();
    await page.getByLabel('HTTP Request').click();
    const tab = await page.getByLabel('Insomnia Tabs').getByLabel(`tab-${DEFAULT_REQUEST_NAME}`, { exact: true });
    expect(tab).toBeVisible();
    await page.getByTestId('New Request').click();
    await page.getByTestId('Dropdown-New-Request').click();
    await page.getByLabel('Delete').click();
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(tab).toBeHidden();
  });

  test('change icon after change request method', async ({ page }) => {
    await page.getByLabel('Create in collection').click();
    await page.getByLabel('HTTP Request').click();
    await page.waitForTimeout(1000);
    expect(await page.getByLabel('Insomnia Tabs').getByLabel('Tab Tag').innerText()).toEqual('GET');
    await page.getByLabel('Request Method').click();
    await page.getByRole('button', { name: 'POST' }).click();
    await page.waitForTimeout(1000);
    expect(await page.getByLabel('Insomnia Tabs').getByLabel('Tab Tag').innerText()).toEqual('POST');
  });

  test('click + button to add a new request', async ({ page }) => {
    await page.getByLabel('Tab Plus').click();
    await page.getByRole('menuitem', { name: 'add request to current' }).click();
    await page.getByTestId(DEFAULT_REQUEST_NAME).click();
    await page.getByTestId(DEFAULT_REQUEST_NAME).dblclick();
    await page.getByRole('textbox', { name: 'GET New Request' }).fill('New Request A');
    await page.getByTestId('project').click();
    await page.getByLabel('Create in project').click();
    await page.getByLabel('Request collection', { exact: true }).click();
    await page.getByPlaceholder('My Collection').fill('Test add tab collection');
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await page.waitForTimeout(1000);
    await page.getByLabel('Tab Plus').click();
    await page.getByRole('menuitem', { name: 'add request to other' }).click();
    await page.getByLabel('Select Workspace').selectOption({ label: 'My Collection' });
    await page.getByRole('dialog').getByRole('button', { name: 'Add' }).click();
    await page.waitForTimeout(1000);
    expect(await page.getByTestId('workspace-context-dropdown').innerText()).toEqual('My Collection');
    await page.getByTestId(DEFAULT_REQUEST_NAME).click();
  });

});
