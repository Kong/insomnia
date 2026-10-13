import { faker } from "@faker-js/faker";

import { CollaboratorRole } from "../../enums/collaborator-role";
import { expect, test } from "../../misc/fixtures";

test("Verify inviting collaborators by email and org member and changing a member's role", async ({
  user,
}) => {
  const { invitePage } = user.pageManager;
  const { organizationFlow } = user.flowManager;

  await invitePage.open();
  const countBeforeInvite = await invitePage.getInvitationCount();

  const existingMemberEmail = "existing-collaborator-1@example.com";
  const invitedEmail = faker.internet.email();
  await organizationFlow.invite(
    { email: invitedEmail },
    { email: "searchable-collaborator-0@example.com", existed: true },
    { email: "searchable-collaborator-1@example.com", existed: true },
    { email: "searchable-collaborator-2@example.com", existed: true },
    { email: "searchable-collaborator-3@example.com", existed: true },
    { email: "searchable-collaborator-4@example.com", existed: true },
    { email: existingMemberEmail, role: CollaboratorRole.Admin },
  );

  await expect
    .poll(async () => invitePage.getInvitationCount())
    .toBe(countBeforeInvite + 6);
  expect(await invitePage.isInvited(invitedEmail)).toBeTruthy();
  expect(await invitePage.getMemberRole(existingMemberEmail)).toBe(
    CollaboratorRole.Admin,
  );
});
