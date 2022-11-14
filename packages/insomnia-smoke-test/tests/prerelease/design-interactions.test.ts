import { expect } from '@playwright/test';

import { test } from '../../playwright/test';

test.describe('Design interactions', async () => {
  // TODO(filfreire): add a few scenarios ported from the release checklist

  test.fixme('Requests are auto-generated when switching tabs', async ({ page }) => {
    // TODO implement
    await page.click('[data-testid="project"] >> text=Insomnia');
    await expect(true).toBeTruthy();
  });

  test.fixme('Can filter values in Design sidebar', async ({ page }) => {
    // TODO implement
    await page.click('[data-testid="project"] >> text=Insomnia');
    await expect(true).toBeTruthy();
  });

  test.fixme('[INS-567] Requests are not duplicated when switching between tabs', async ({ page }) => {
    // TODO implement
    await page.click('[data-testid="project"] >> text=Insomnia');
    await expect(true).toBeTruthy();
  });

  test.fixme('Unit Test interactions', async ({ page }) => {
    // TODO implement
    // switch to the test tab
    // create a new test suite
    // add a new test
    // use the autocomplete inside the test code
    // run tests and check the results
    // rename the test
    // rename the test suite
    await page.click('[data-testid="project"] >> text=Insomnia');
    await expect(true).toBeTruthy();
  });
});
