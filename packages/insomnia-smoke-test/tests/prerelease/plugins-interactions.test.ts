import { expect } from '@playwright/test';

import { test } from '../../playwright/test';

test.describe('Plugins', async () => {
  test('Open plugins menu and generate plugin', async ({ page }) => {
    // Opening settings
    await page.locator('[data-testid="settings-button"]').click();
    // Switching to Plugins tab
    await page.locator('div[role="tab"]:has-text("Plugins")').click();

    // Generate new plugin
    await page.locator('text=Generate New Plugin').click();
    await page.locator('text=Generate').first().click();

    // check if the plugin shows up on the plugin list
    await expect(page.locator('.app')).toContainText('insomnia-plugin-demo-example');
  });

  test('Check Declarative Config and Kong Kubernetes config', async ({ page }) => {
    // Switch to design tab
    await page.click('text=Design');

    // Set example OpenAPI spec
    await page.click('text=start from an example');
    await expect(page.locator('.app')).toContainText('This is a sample server Petstore server');

    // Open declarative config
    await page.click('button:has-text("New Document")');
    await page.click('button:has-text("Declarative Config")');

    // Check for declarative config contents
    await page.click('text=/.*"_format_version".*/');

    // Switch to Kong for Kubernetes tab
    await page.click('div[role="tab"]:has-text("Kong for Kubernetes")');

    // Check for Kong for Kubernetes contents
    await page.click('text=apiVersion: networking.k8s.io/v1');
  });

  // TODO: more scenarios will be added in follow-up iterations of increasing test coverage
});
