import { expect } from '@playwright/test';

//import { loadFixture } from '../playwright/paths';
import { test } from '../playwright/test';

test('can render Petstore internal example', async ({ app, page }) => {
  test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');
  const specPreview = page.locator('.information-container');

  await page.click('[data-testid="project"]');
  await page.click('text=Create');
  await page.click('button:has-text("Design Document")');
  await page.click('.modal__footer >> text=Create');
  await page.click('text=start from an example');

  await expect(specPreview).toContainText('This is a sample server Petstore server');
});

