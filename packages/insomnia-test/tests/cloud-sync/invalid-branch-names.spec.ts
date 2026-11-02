import { faker } from "@faker-js/faker";
import { test } from "@package/misc/fixtures";
import { expect } from "@playwright/test";

const CHARSET_ERROR =
  "Branch names must be at least 3 characters long and can only contain English letters, numbers, period (.), hyphen (-), underscore (_) and forward slash (/)";

const INVALID_NAMES = [
  { name: "ab", error: CHARSET_ERROR },
  { name: "has space", error: CHARSET_ERROR },
  { name: "-leading", error: "Branch names must start with a letter or number" },
  { name: "trailing/", error: "Branch names must not end with a forward slash (/)" },
  { name: "double//slash", error: "Branch names must not contain consecutive forward slashes (//)" },
  { name: "trailing.", error: "Branch names must not end with a period (.)" },
  { name: "double..dot", error: "Branch names must not contain consecutive periods (..)" },
  {
    name: "parent/.hidden",
    error: "No slash-separated component in branch name can begin with a period (.)",
  },
  {
    name: "parent/child.lock",
    error: "No slash-separated component in branch name can end with the sequence .lock",
  },
];

test("Verify creating a branch with an invalid or already-used name is rejected with an error on a Cloud-synced workspace", async ({
  user,
}) => {
  const { cloudSyncFlow } = user.flowManager;
  const { cloudSyncPage, cloudSyncBranchesDialogPage } = user.pageManager;

  await cloudSyncFlow.fetch("My Collection R1");
  await cloudSyncPage.openBranchesDialog();
  for (const { name, error } of INVALID_NAMES) {
    await cloudSyncBranchesDialogPage.createBranch(name);
    await cloudSyncBranchesDialogPage.waitForBranchCreationError(error);
  }

  const existingBranch = faker.git.branch();
  await cloudSyncBranchesDialogPage.createBranch(existingBranch);
  await expect
    .poll(() => cloudSyncBranchesDialogPage.isLocalBranchListed(existingBranch))
    .toBe(true);
  await cloudSyncBranchesDialogPage.createBranch(existingBranch);
  await cloudSyncBranchesDialogPage.waitForBranchCreationError(
    `Branch already exists by name ${existingBranch}`,
  );
  for (const { name } of INVALID_NAMES) {
    await cloudSyncBranchesDialogPage.waitForLocalBranchRemoved(name);
  }
});
