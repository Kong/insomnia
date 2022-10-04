import { expect } from '@playwright/test';

import { test } from '../../playwright/test';

test('Basic interactions', async ({ }) => {
  // TODO(filfreire): add a few scenarios ported from the release checklist

  await expect(true).toBeTruthy();
});
