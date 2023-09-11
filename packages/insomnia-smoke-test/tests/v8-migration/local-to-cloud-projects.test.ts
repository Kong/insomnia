import { expect } from '@playwright/test';

import { copyFixtureDatabase } from '../../playwright/paths';
import { test } from '../../playwright/test';

test('Run data migration to version 8', async ({ app, page, dataPath }) => {
  await copyFixtureDatabase('insomnia-legacy-db', dataPath);

  // Set up localStorage so that we don't see the onboarding screen
  await page.evaluate(() => {
    localStorage.setItem('hasSeenOnboarding', 'true');
    localStorage.setItem('hasUserLoggedInBefore', 'true');
    localStorage.setItem('insomnia.secretKey', 'gIEn+iRK7XoFOgRSpkYxNj6y5UC7F4oM8oRY6KArPs4=');
    localStorage.setItem('insomnia.publicKey', 'BDox5GCH710H/6XMWSRw3Pf/E0WJaD1kWekvwR+XW0s=');
  });

  // @TODO - Figure out if there's a better way to load the localStorage before the app starts
  await page.reload();

  await page.getByLabel('Continue with Google').click();
  const fakeToken = '1zd0y0m2AtNQScA5DiUCxB1qab96yB9aO5S9pMWc3kBI%2Bdw330DISdVTQXrRNCxE8Ydm0%2BKa2SD6A0EBV%2FkR4DDqLFm6SwPS9YoUCbQMaDD11mXdqTSrp2%2B7%2Fp5%2FKbl7JLUarZtN19Y3%2FoZttMlKsPPOZqnMF6Fa%2BS0eNWFFNA8I%2BPn7dnuSYXbcIYRnTGwlNxHQnP77JWG8RMMp4qYF9JI3jDEdV1zOuz6A5kaapsaGhRj2i3lw0ra2tFg3LE%2F9aa7XAFI%3D';

  await page.locator('input[name="code"]').click();
  await page.locator('input[name="code"]').fill(fakeToken);

  await page.locator('button[type="submit"]').click();
});
