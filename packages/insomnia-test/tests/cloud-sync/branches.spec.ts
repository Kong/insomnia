import { faker } from "@faker-js/faker";

import { DEFAULT_TIMEOUT,expect, test } from "../../misc/fixtures";

test("Verify fetching a remote branch, checking out, deleting a local branch, and creating a new branch on a Cloud-synced workspace", async ({
  user,
}) => {
  const { cloudSyncFlow } = user.flowManager;
  const { cloudSyncPage } = user.pageManager;

  await cloudSyncFlow.fetch("My MCP Client");
  await cloudSyncPage.openBranchesDialog();
  await cloudSyncPage.fetchRemoteBranch("develop");

  await expect
    .poll(() => cloudSyncPage.isLocalBranchListed("develop"), {
      timeout: DEFAULT_TIMEOUT,
    })
    .toBe(true);

  await cloudSyncPage.checkoutLocalBranch("master");
  await cloudSyncPage.deleteLocalBranch("develop");

  await expect
    .poll(() => cloudSyncPage.isLocalBranchListed("develop"), {
      timeout: DEFAULT_TIMEOUT,
    })
    .toBe(false);

  const newBranch = faker.git.branch();
  await cloudSyncPage.createBranch(newBranch);

  await expect
    .poll(() => cloudSyncPage.isLocalBranchListed(newBranch), {
      timeout: DEFAULT_TIMEOUT,
    })
    .toBe(true);
  expect(await cloudSyncPage.isLocalBranchDeleteDisabled(newBranch)).toBe(true);
  await cloudSyncPage.closeBranchesDialog();
});
