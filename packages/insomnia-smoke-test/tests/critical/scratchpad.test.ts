import { test } from '../../playwright/test';

test('can open scratchpad', async ({ page }) => {
    await page.locator('[data-testid="user-dropdown"]').click();
    await page.getByText('Log Out').click();
    await page.getByLabel('Use the Scratch Pad').click();
    await page.getByText('Welcome to the Scratch Pad').click();
});
