import { expect } from '@playwright/test';

import { test } from '../../playwright/test';

test.describe('multiple-tab feature test', () => {
  test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');

  test('tabs', async ({ page }) => {
    // add tab & close tab
    await page.getByRole('button', { name: 'Create request collection', exact: true }).click();
    await page.getByLabel('Create in collection').click();
    await page.getByLabel('HTTP Request').click();
    const tab = page.getByLabel('Insomnia Tabs').getByLabel(`tab-New Request`, { exact: true });
    await expect.soft(tab).toBeVisible();
    await expect.soft(tab).toHaveAttribute('data-selected', 'true');
    await tab.getByRole('button').click();
    await expect.soft(tab).toBeHidden();

    // active tab sync with the sidebar active request
    await page.getByTestId('project').click();
    await page.getByLabel('Create in project').click();
    await page.getByText('Request collection').click();
    await page.getByRole('button', { name: 'Create' }).click();

    await page.getByLabel('Create in collection').click();
    await page.getByLabel('HTTP Request').click();
    await page.getByTestId('New Request').dblclick();
    await page.getByRole('textbox', { name: 'GET New Request' }).fill('foo');
    // Click outside the input to trigger the blur event
    await page.locator('body').click();
    await page.getByTestId('foo').click();
    await page.getByLabel('Create in collection').click();
    await page.getByLabel('HTTP Request').click();
    // check new request created
    await page.getByTestId('New Request').isVisible();
    await page.getByTestId('New Request').dblclick();
    await page.getByRole('textbox', { name: 'GET New Request' }).fill('bar');
    // Click outside the input to trigger the blur event
    await page.locator('body').click();
    await page.getByTestId('bar').click();
    await page.getByTestId('foo').click();

    const tabA = page.getByLabel('Insomnia Tabs').getByLabel('tab-foo', { exact: true });
    await expect.soft(tabA).toHaveAttribute('data-selected', 'true');
    await page.getByTestId('bar').click();

    const tabB = page.getByLabel('Insomnia Tabs').getByLabel('tab-bar', { exact: true });
    await expect.soft(tabB).toHaveAttribute('data-selected', 'true');

    //change icon after change request method
    await page.getByTestId('project').click();
    await page.getByLabel('Create in project').click();
    await page.getByText('Request collection').click();
    await page.getByRole('button', { name: 'Create' }).click();
    await page.getByLabel('Create in collection').click();
    await page.getByLabel('HTTP Request').click();
    await expect.soft(page.getByLabel('tab-New Request').getByLabel('Tab Tag')).toHaveText('GET');
    await page.getByTestId('tab-close-button').first().click();
    await page.getByLabel('Request Method').click();
    await page.getByRole('button', { name: 'POST' }).click();
    await expect.soft(page.getByLabel('tab-New Request').getByLabel('Tab Tag')).toHaveText('POST');

    //click + button to add a new request
    await page.getByTestId('project').click();
    await page.getByLabel('Create in project').click();
    await page.getByText('Request collection').click();
    await page.getByRole('button', { name: 'Create' }).click();
    await page.getByLabel('Tab Plus').click();
    await page.getByRole('menuitem', { name: 'add request to current' }).click();
    await page.getByTestId('New Request').click();
    await page.getByTestId('New Request').dblclick();
    await page.getByRole('textbox', { name: 'GET New Request' }).fill('foo');
    await page.getByTestId('project').click();
    await page.getByLabel('Create in project').click();
    await page.getByLabel('Request collection', { exact: true }).click();
    await page.getByPlaceholder('Enter a name for your Request Collection').fill('Test add tab collection');
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await page.getByLabel('Tab Plus').click();
    await page.getByRole('menuitem', { name: 'add request to other' }).click();
    await page.getByLabel('Select Workspace').selectOption({ label: 'My first collection' });
    await page.getByRole('dialog').getByRole('button', { name: 'Add' }).click();
    await expect.soft(page.getByTestId('workspace-context-dropdown')).toHaveText('My first collection');

    // close tab after delete a request
    await page.getByTestId('project').click();
    await page.getByLabel('Create in project').click();
    await page.getByText('Request collection').click();
    await page.getByRole('button', { name: 'Create' }).click();
    await page.getByLabel('Create in collection').click();
    await page.getByLabel('HTTP Request').click();
    await page.getByTestId('New Request').click();
    await page.getByTestId('Dropdown-New-Request').click();
    await page.getByLabel('Delete').click();
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
  });
});
