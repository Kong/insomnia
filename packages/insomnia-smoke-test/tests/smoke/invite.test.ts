import { expect } from '@playwright/test';

import { test } from '../../playwright/test';
import { getUserEmail } from './test-utils';

const testUser = getUserEmail();

test('Can invite users in app', async ({ page }) => {
  await page.getByLabel('Invite collaborators').click();

  // invite a new member
  await page.getByPlaceholder('Enter emails, separated by').click();
  await page.getByPlaceholder('Enter emails, separated by').fill(testUser);

  const organizationMembersSelector = page.getByLabel('Organization members');
  // Iterate through the first five options and click each one
  for (let i = 0; i < 5; i++) {
    // Get each option of the listbox
    await organizationMembersSelector.getByRole('option').nth(i).click();
  }

  await page.getByText('Invite collaborators').click();

  await page.getByRole('button', { name: 'Invite', exact: true }).click();

  const invitationListLocator = page.getByLabel('Invitation list');
  // Check that the new member is in the list
  await expect.soft(invitationListLocator.getByRole('option')).toHaveCount(15);

  // Change the role
  const thirdMemberInTheListLocator = invitationListLocator.getByRole('option').nth(2);
  await thirdMemberInTheListLocator.getByLabel('Menu').click();
  await page.getByLabel('admin').click();

  // @TODO Bring this back when we fix the Prompt button api to be testable
  // // Revoke the invitation
  // const fourthMemberInTheListLocator = invitationListLocator.getByRole('option').nth(3);
  // await fourthMemberInTheListLocator.getByLabel('Revoke').click();
  // // Confirm the revokation
  // await fourthMemberInTheListLocator.getByLabel('Revoke').click();

  // // Unlink the team. The team is showing as the first option in the list
  // const firstMemberInTheListLocator = invitationListLocator.getByRole('option').nth(0);
  // // Remove the team
  // await firstMemberInTheListLocator.getByLabel('Remove').click();
  // // Confirm the deletion
  // await firstMemberInTheListLocator.getByLabel('Remove').click();
});
