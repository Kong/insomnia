import { expect } from '@playwright/test';

import { test } from '../../playwright/test';

test.describe('multiple-tab feature test', () => {
  test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');

  test('tabs', async ({ page, insomnia }) => {
    // add tab & close tab
    await page.getByRole('button', { name: 'Create request collection', exact: true }).click();
    await insomnia.navigationSidebar.selectWorkspaceDropdownOption({
      workspaceName: 'My first collection',
      actionName: 'HTTP Request',
    });
    await insomnia.navigationSidebar.requestRow('My first request').click({ modifiers: ['ControlOrMeta'] });
    await insomnia.navigationSidebar.requestRow('New Request').click({ modifiers: ['ControlOrMeta'] });
    const tab = page.getByLabel('Insomnia Tabs').getByLabel(`tab-New Request`, { exact: true });
    await expect.soft(tab).toBeVisible();
    await expect.soft(tab).toHaveAttribute('data-selected', 'true');
    await tab.getByRole('button').click();
    await expect.soft(tab).toBeHidden();
    await insomnia.navigationSidebar.renameRequestOrFolder('New Request', 'first request');

    // active tab sync with the sidebar active request
    await page.getByTestId('workspace-breadcrumb-level-0').click();
    await page.getByLabel('Create in project').click();
    await page.getByText('Request collection').click();
    await page.getByRole('dialog').getByRole('button', { name: 'Create' }).click();

    await insomnia.navigationSidebar.selectWorkspaceDropdownOption({
      workspaceName: 'My Collection',
      actionName: 'HTTP Request',
    });
    // rename
    await insomnia.navigationSidebar.renameRequestOrFolder('New Request', 'foo');

    await insomnia.navigationSidebar.selectWorkspaceDropdownOption({
      workspaceName: 'My first collection',
      actionName: 'HTTP Request',
    });
    await insomnia.navigationSidebar.renameRequestOrFolder('New Request', 'bar');

    await insomnia.navigationSidebar.clickRequestOrFolder('bar');
    await insomnia.navigationSidebar.clickRequestOrFolder('foo');
    const tabA = page.getByLabel('Insomnia Tabs').getByLabel('tab-foo', { exact: true });
    await expect.soft(tabA).toHaveAttribute('data-selected', 'true');
    await insomnia.navigationSidebar.clickRequestOrFolder('bar');
    const tabB = page.getByLabel('Insomnia Tabs').getByLabel('tab-bar', { exact: true });
    await expect.soft(tabB).toHaveAttribute('data-selected', 'true');

    //change icon after change request method
    await page.getByTestId('workspace-breadcrumb-level-0').click();
    await page.getByLabel('Create in project').click();
    await page.getByText('Request collection').click();
    await page.getByRole('dialog').getByRole('button', { name: 'Create' }).click();
    await insomnia.navigationSidebar.selectWorkspaceDropdownOption({
      workspaceName: 'My first collection',
      actionName: 'HTTP Request',
    });
    await insomnia.navigationSidebar.requestRow('New Request').click({ modifiers: ['ControlOrMeta'] });
    await page.getByTestId('tab-close-button').first().click();
    // Move the mouse away to avoid accidentally show the tooltip of the tab which may cover the request method dropdown and cause the click fail
    await page.mouse.move(0, 0);
    await page.getByLabel('Request Method').click();
    await page.getByRole('button', { name: 'POST' }).click();

    //click + button to add a new request
    await page.getByTestId('workspace-breadcrumb-level-0').click();
    await page.getByLabel('Create in project').click();
    await page.getByText('Request collection').click();
    await page.getByRole('dialog').getByRole('button', { name: 'Create' }).click();
    await page.getByLabel('Tab Plus').click();
    await page.getByRole('menuitem', { name: 'add request to current' }).click();
    await insomnia.navigationSidebar.renameRequestOrFolder('New Request', 'foo');
    await page.getByLabel('Insomnia Tabs').getByLabel('tab-foo', { exact: true }).click();

    await page.getByTestId('workspace-breadcrumb-level-0').click();
    await page.getByLabel('Create in project').click();
    await page.getByLabel('Request collection', { exact: true }).click();
    await page.getByPlaceholder('Enter a name for your Request Collection').fill('Test add tab collection');
    await page.getByRole('dialog').getByRole('button', { name: 'Create' }).click();
    await page.getByLabel('Tab Plus').click();
    await page.getByRole('menuitem', { name: 'add request to other' }).click();
    await page.getByLabel('Select Workspace').selectOption({ label: 'My first collection' });
    await page.getByRole('dialog').getByRole('button', { name: 'Add' }).click();
    await expect.soft(insomnia.navigationSidebar.requestRow('New Request', 'My first collection')).toBeVisible();

    // close tab after delete a request
    await insomnia.navigationSidebar.selectProject('Personal Workspace');
    await page.getByLabel('Create in project').click();
    await page.getByText('Request collection').click();
    await page.getByPlaceholder('Enter a name for your Request Collection').fill('Delete request test collection');
    await page.getByRole('dialog').getByRole('button', { name: 'Create' }).click();
    await insomnia.navigationSidebar.selectWorkspaceDropdownOption({
      workspaceName: 'Delete request test collection',
      actionName: 'HTTP Request',
    });
    await insomnia.navigationSidebar.selectRequestDropdownOption({
      requestName: 'New Request',
      actionName: 'Delete',
      workspaceName: 'Delete request test collection',
    });
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect
      .soft(insomnia.navigationSidebar.requestRow('New Request', 'Delete request test collection'))
      .toBeHidden();
  });
});
