import { expect } from '@playwright/test';

import { seedSettings } from '../../playwright/paths';
import { test as baseTest } from '../../playwright/test';

// sidebarFocusForCollections defaults to on for real users (creating a collection
// immediately focuses the sidebar on it), but the smoke-test harness defaults it off so the
// rest of the suite isn't affected by focus mode (see playwright/test.ts). This spec is about
// focus mode itself, so turn it back on for these tests specifically.
const test = baseTest.extend({
  dataPath: async ({ dataPath }, use) => {
    await seedSettings(dataPath, { sidebarFocusForCollections: true });
    await use(dataPath);
  },
});

// This covers the one-time "Welcome to focus mode" nudge that explains that behavior and
// confirms dismissing it is actually persisted, not just in-memory for the session.
test.describe('sidebar focus mode onboarding', () => {
  test('shows once on first focus and stays dismissed after reload', async ({ page, insomnia }) => {
    // A brand-new project starts empty, so the first collection comes from this welcome-state
    // button rather than the "Create in project" menu (which only appears once a project has content).
    await page.getByRole('button', { name: 'Create request collection', exact: true }).click();
    await insomnia.navigationSidebar.expectWorkspaceActive('My first collection');

    const onboarding = page.getByRole('dialog', { name: 'Sidebar focus mode onboarding' });
    await expect.soft(onboarding).toBeVisible();
    await expect.soft(onboarding.getByText('Welcome to focus mode')).toBeVisible();
    await expect.soft(onboarding.getByText('back arrow')).toBeVisible();
    await expect.soft(onboarding.getByText('Sidebar focus for collections')).toBeVisible();

    await onboarding.getByRole('button', { name: 'Got It' }).click();
    await expect.soft(onboarding).toBeHidden();

    // Leaving and re-entering focus mode in the same session shouldn't bring it back.
    await insomnia.navigationSidebar.backToAllProjects();
    await insomnia.navigationSidebar.selectWorkspace('My first collection');
    await insomnia.navigationSidebar.expectWorkspaceActive('My first collection');
    await expect.soft(onboarding).toBeHidden();

    // Reload to confirm the dismissal was actually written to settings, not just in-memory state.
    await page.reload({ waitUntil: 'networkidle' });
    await insomnia.navigationSidebar.expectWorkspaceActive('My first collection');
    await expect.soft(onboarding).toBeHidden();
  });

  test('does not show when the setting is turned off', async ({ page, insomnia }) => {
    await page.getByTestId('settings-button').click();
    await page.locator('text=Insomnia Preferences').first().click();
    await page.locator('text=Sidebar focus for collections').click();
    await page.locator('.app').press('Escape');

    await page.getByRole('button', { name: 'Create request collection', exact: true }).click();

    const onboarding = page.getByRole('dialog', { name: 'Sidebar focus mode onboarding' });
    await expect.soft(onboarding).toBeHidden();
    await expect.soft(insomnia.navigationSidebar.workspaceGridListItem('My first collection')).toBeVisible();
  });
});
