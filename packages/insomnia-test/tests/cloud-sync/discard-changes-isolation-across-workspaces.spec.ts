import { faker } from "@faker-js/faker";

import { expect, test } from "../../misc/fixtures";

test("Verify discarding changes on one Cloud-synced workspace does not affect another workspace's uncommitted edits", async ({
  user,
}) => {
  const { workspaceFlow, httpRequestFlow, mcpClientFlow, cloudSyncFlow } =
    user.flowManager;
  const { httpRequestPage, mcpClientPage } = user.pageManager;

  await cloudSyncFlow.fetch("My Collection R1");
  const collectionX = await workspaceFlow.getCollection({
    name: "My Collection R1",
  });
  const requestXBefore = await httpRequestFlow.get("New Request", collectionX);
  const editedUrlX = faker.internet.url();
  await httpRequestPage.setUrl(editedUrlX);

  await cloudSyncFlow.fetch("My MCP Client");
  const clientYBefore = await mcpClientFlow.get("My MCP Client");
  await mcpClientPage.setUrl(faker.internet.url());
  await cloudSyncFlow.discardAllChanges();
  await user.page.reload();
  const clientYAfterDiscard = await mcpClientFlow.get("My MCP Client");

  const requestXAfterDiscard = await httpRequestFlow.get(
    "New Request",
    collectionX,
  );

  expect(clientYAfterDiscard?.url).toBe(clientYBefore?.url);
  expect(requestXAfterDiscard?.url).toBe(editedUrlX);
  expect(requestXAfterDiscard?.url).not.toBe(requestXBefore?.url);
});
