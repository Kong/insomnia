import { expect } from '@playwright/test';

import { test } from '../../playwright/test';

test('analytics events are sent', async ({ page }) => {
    const messages = [];
    page.on('console', msg => {
        if (msg.text().includes('[playwright-analytics] analytics debug')) {
            messages.push(msg.text());
        }
    });

    // actions cause analytics events:
    await page.locator('[data-testid="settings-button"]').click();
    await page.locator('text=Insomnia Preferences').first().click();
    expect(messages.length).toBeGreaterThan(0);
    // TODO(filipe) - check for userID and anonymousID, logout and then check for anonymousID only?
});
