import { faker } from "@faker-js/faker";
import { expect } from "@playwright/test";

import { DEFAULT_TIMEOUT, test } from "@package/misc/fixtures";

test("Verify fetching a remote branch, checking out, deleting a local branch, and creating a new branch on a Cloud-synced workspace", async ({
  user,
}) => {
  const { cloudSyncFlow } = user.flowManager;
  const { cloudSyncPage, cloudSyncBranchesDialogPage } = user.pageManager;

  await cloudSyncFlow.fetch("My MCP Client");
  await cloudSyncPage.openBranchesDialog();
  await cloudSyncBranchesDialogPage.fetchRemoteBranch("develop");

  await expect
    .poll(() => cloudSyncBranchesDialogPage.isLocalBranchListed("develop"), {
      timeout: DEFAULT_TIMEOUT,
    })
    .toBe(true);

  await cloudSyncBranchesDialogPage.checkoutLocalBranch("master");
  await cloudSyncBranchesDialogPage.deleteLocalBranch("develop");

  await cloudSyncBranchesDialogPage.waitForLocalBranchRemoved("develop");

  const newBranch = faker.git.branch();
  await cloudSyncBranchesDialogPage.createBranch(newBranch);

  await expect
    .poll(() => cloudSyncBranchesDialogPage.isLocalBranchListed(newBranch), {
      timeout: DEFAULT_TIMEOUT,
    })
    .toBe(true);
  expect(await cloudSyncBranchesDialogPage.isLocalBranchDeleteDisabled(newBranch)).toBe(true);
  await cloudSyncBranchesDialogPage.closeBranchesDialog();
});
