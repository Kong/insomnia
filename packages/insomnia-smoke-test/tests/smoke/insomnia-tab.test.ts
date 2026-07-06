import { expect } from '@playwright/test';

import { test } from '../../playwright/test';

test.describe('multiple-tab feature test', () => {
  test.slow();

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
    await tab.waitFor({ state: 'hidden' });
    await expect.soft(tab).toBeHidden();
    await insomnia.navigationSidebar.renameRequestOrFolder('New Request', 'first request', 'My first collection');

    // active tab sync with the sidebar active request
    await insomnia.projectPage.navigateFromWorkspaceBreadcrumb();
    await insomnia.projectPage.createCollection('Tab sync collection');

    await insomnia.navigationSidebar.selectWorkspaceDropdownOption({
      workspaceName: 'Tab sync collection',
      actionName: 'HTTP Request',
    });
    // rename
    await insomnia.navigationSidebar.renameRequestOrFolder('New Request', 'foo', 'Tab sync collection');

    await insomnia.navigationSidebar.selectWorkspaceDropdownOption({
      workspaceName: 'My first collection',
      actionName: 'HTTP Request',
    });
    await insomnia.navigationSidebar.renameRequestOrFolder('New Request', 'bar', 'My first collection');

    await insomnia.navigationSidebar.clickRequestOrFolder('bar');
    await insomnia.navigationSidebar.clickRequestOrFolder('foo');
    const tabA = page.getByLabel('Insomnia Tabs').getByLabel('tab-foo', { exact: true });
    await expect.soft(tabA).toHaveAttribute('data-selected', 'true');
    await insomnia.navigationSidebar.clickRequestOrFolder('bar');
    const tabB = page.getByLabel('Insomnia Tabs').getByLabel('tab-bar', { exact: true });
    await expect.soft(tabB).toHaveAttribute('data-selected', 'true');

    //change icon after change request method
    await insomnia.projectPage.navigateFromWorkspaceBreadcrumb();
    await insomnia.projectPage.createCollection('Method icon collection');
    await insomnia.navigationSidebar.selectWorkspaceDropdownOption({
      workspaceName: 'My first collection',
      actionName: 'HTTP Request',
    });
    await insomnia.navigationSidebar.renameRequestOrFolder('New Request', 'method request', 'My first collection');
    await insomnia.navigationSidebar.requestRow('method request').click({ modifiers: ['ControlOrMeta'] });
    await page.getByTestId('tab-close-button').first().click();
    // Move the mouse away to avoid accidentally show the tooltip of the tab which may cover the request method dropdown and cause the click fail
    await page.mouse.move(0, 0);
    await page.getByLabel('Request Method').waitFor({ state: 'visible' });
    await page.getByLabel('Request Method').click();
    await page.getByRole('button', { name: 'POST' }).click();

    //click + button to add a new request
    await insomnia.projectPage.navigateFromWorkspaceBreadcrumb();
    await insomnia.projectPage.createCollection('Plus button collection');
    await page.getByLabel('Tab Plus', { exact: true }).click();
    await page.getByRole('menuitem', { name: 'add request to current' }).waitFor({ state: 'visible' });
    await page.getByRole('menuitem', { name: 'add request to current' }).click();
    await insomnia.navigationSidebar.renameRequestOrFolder('New Request', 'plus request', 'Plus button collection');
    await page.getByLabel('Insomnia Tabs').getByLabel('tab-plus request', { exact: true }).click();

    await page.mouse.move(0, 0);
    await insomnia.projectPage.navigateFromWorkspaceBreadcrumb();
    await insomnia.projectPage.createCollection('Test add tab collection');
    await page.getByLabel('Tab Plus', { exact: true }).click();
    await page.getByRole('menuitem', { name: 'add request to other' }).waitFor({ state: 'visible' });
    await page.getByRole('menuitem', { name: 'add request to other' }).click();
    await page.getByLabel('Select Workspace').waitFor({ state: 'visible' });
    await page.getByLabel('Select Workspace').selectOption({ label: 'My first collection' });
    await page.getByRole('dialog').getByRole('button', { name: 'Add' }).click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    await expect.soft(insomnia.navigationSidebar.requestRow('New Request', 'My first collection')).toBeVisible();

    // close tab after delete a request
    await insomnia.navigationSidebar.selectProject('Personal Workspace');
    await insomnia.projectPage.waitForProjectDashboard();
    await insomnia.projectPage.createCollection('Delete request test collection');
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
