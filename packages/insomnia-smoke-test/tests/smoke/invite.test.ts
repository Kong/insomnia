import { expect } from '@playwright/test';

import { test } from '../../playwright/test';
import { getUserEmail } from './test-utils';

const testUser = getUserEmail();

test('Can invite users in app', async ({ page }) => {
  await page.getByLabel('Invite collaborators').click();

  // invite a new member
  await page.getByPlaceholder('Enter emails, separated by').click();
  await page.getByPlaceholder('Enter emails, separated by').fill(testUser);

  // Iterate through the first five options and click each one
  for (let i = 0; i < 5; i++) {
    const testId = `search-test-result-iteration-${i}`;
    await page.getByTestId(testId).click();
  }

  await page.getByText('Invite collaborators').click();

  await page.getByRole('button', { name: 'Invite', exact: true }).click();

  // Check that the new member is in the list
  await expect(page.getByLabel('Invitation list').getByRole('option')).toHaveCount(15);

  // Change the role
  await page.getByTestId('collaborator-test-iteration-2').getByLabel('Menu').click();
  await page.getByLabel('admin').click();

  // Delete the member
  await page.getByTestId('collaborator-test-iteration-3').getByRole('button').nth(2).click();
  await page.getByRole('button', { name: 'Confirm' }).click();

  // Unlink the team
  await page.getByTestId('collaborator-test-iteration-0').getByRole('button', { name: 'Remove' }).click();
  await page.getByRole('button', { name: 'Confirm' }).click();
});
