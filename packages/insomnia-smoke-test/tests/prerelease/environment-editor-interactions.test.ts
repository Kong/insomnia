import { expect } from '@playwright/test';

import { test } from '../../playwright/test';

test.describe('Environment Editor', async () => {

  // create a new environment

  // rename an existing environment

  // add a new string environment variable

  // add a new numeric environment variable

  // add an environment variable that returns value of a nunjucks template (e.g. timestamp)

  // add an environment variable that is not properly formatted and you see a validation error

  test('Interactions', async ({ }) => {
    // TODO(filfreire): add a few scenarios ported from the release checklist

    await expect(true).toBeTruthy();
  });
});
