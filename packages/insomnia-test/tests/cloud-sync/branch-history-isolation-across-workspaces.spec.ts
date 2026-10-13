import { faker } from "@faker-js/faker";

import { expect, test } from "../../misc/fixtures";

test("Verify branch, commit, merge, and restore actions on one Cloud-synced workspace do not affect another workspace's branches or content", async ({
  user,
}) => {
  const { workspaceFlow, httpRequestFlow, mcpClientFlow, cloudSyncFlow } =
    user.flowManager;
  const { httpRequestPage, mcpClientPage, cloudSyncPage } = user.pageManager;

  await cloudSyncFlow.fetch("My Collection R1");
  const collectionX = await workspaceFlow.getCollection({
    name: "My Collection R1",
  });
  await httpRequestFlow.get("New Request", collectionX);
  await httpRequestPage.setUrl(faker.internet.url());
  const branchX = faker.git.branch();
  await cloudSyncFlow.createBranch(branchX);
  await cloudSyncFlow.commitAndPush("New Request", faker.lorem.sentence());
  await cloudSyncFlow.mergeBranch("master");
  const isCommitDisabledOnX = await cloudSyncPage.isCommitDisabled();
  await cloudSyncFlow.restoreSnapshot("Initial Snapshot");
  await user.page.reload();
  const requestXAfterRestore = await httpRequestFlow.get(
    "New Request",
    collectionX,
  );

  await cloudSyncFlow.fetch("My MCP Client");
  await mcpClientFlow.get("My MCP Client");
  await mcpClientPage.setUrl(faker.internet.url());
  const branchY = faker.git.branch();
  await cloudSyncFlow.createBranch(branchY);
  await cloudSyncFlow.commitAndPush("MCP Request", faker.lorem.sentence());
  await cloudSyncFlow.mergeBranch("master");
  const isCommitDisabledOnY = await cloudSyncPage.isCommitDisabled();
  await cloudSyncFlow.restoreSnapshot("Initial Snapshot");
  await user.page.reload();
  const clientYAfterRestore = await mcpClientFlow.get("My MCP Client");

  await httpRequestFlow.get("New Request", collectionX);
  await cloudSyncPage.openBranchesDialog();
  const branchXListedOnX = await cloudSyncPage.isLocalBranchListed(branchX);
  const branchYListedOnX = await cloudSyncPage.isLocalBranchListed(branchY);
  await cloudSyncPage.closeBranchesDialog();
  await mcpClientFlow.get("My MCP Client");
  await cloudSyncPage.openBranchesDialog();
  const branchYListedOnY = await cloudSyncPage.isLocalBranchListed(branchY);
  const branchXListedOnY = await cloudSyncPage.isLocalBranchListed(branchX);
  await cloudSyncPage.closeBranchesDialog();

  expect(requestXAfterRestore?.url).toBe("");
  expect(clientYAfterRestore?.url).toBe("");
  expect(isCommitDisabledOnX).toBe(true);
  expect(isCommitDisabledOnY).toBe(true);
  expect(branchXListedOnX).toBe(true);
  expect(branchYListedOnX).toBe(false);
  expect(branchYListedOnY).toBe(true);
  expect(branchXListedOnY).toBe(false);
});
