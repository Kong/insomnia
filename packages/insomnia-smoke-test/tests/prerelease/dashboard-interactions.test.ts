import { expect } from '@playwright/test';

import { test } from '../../playwright/test';

test.describe('Dashboard', async () => {
  test('todo', async ({ }) => {
    await expect(true).toBeTruthy();
  });
});
