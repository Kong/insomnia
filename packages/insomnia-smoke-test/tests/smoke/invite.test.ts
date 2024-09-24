import { expect } from '@playwright/test';

import { test } from '../../playwright/test';

test('Can invite users in app', async ({ page }) => {
  await page.getByLabel('Invite collaborators').click();
  // have 5 members
  await expect(page.getByLabel('Invitation list').getByRole('option')).toHaveCount(5);
  // invite a new member
  await page.getByPlaceholder('Enter emails, separated by').click();
  await page.getByPlaceholder('Enter emails, separated by').fill('wei.yao+5@konghq.com');
  await page.getByRole('button', { name: 'Invite', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Failed to fetch available seats');
});
