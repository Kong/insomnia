import { faker } from "@faker-js/faker";
import { HttpMethod } from "@package/enums/http-method";
import { TreeNodeType } from "@package/enums/tree-node-types";
import { HTTP_SERVER, test } from "@package/misc/fixtures";
import type { Collection } from "@package/models/collection";
import { expect } from "@playwright/test";

test("Verify restoring an earlier snapshot removes a request added and committed after it on a Cloud-synced workspace", async ({
  user,
}) => {
  const { workspaceFlow, httpRequestFlow, cloudSyncFlow } = user.flowManager;
  const { workspacePage } = user.pageManager;

  await cloudSyncFlow.fetch("My Collection R1");
  const collection = await workspaceFlow.getCollection({
    name: "My Collection R1",
  });
  const addedName = faker.string.alphanumeric(10);
  await httpRequestFlow.create(collection as Collection, {
    name: addedName,
    url: `${HTTP_SERVER}/get`,
    method: HttpMethod.Get,
  });
  const addedNode = await workspacePage.requireItemNode(
    { name: addedName },
    TreeNodeType.Request,
  );
  await cloudSyncFlow.commit(addedName, faker.lorem.sentence());

  await cloudSyncFlow.restoreSnapshot("Initial Snapshot");
  // The restore lands asynchronously and a reload before then aborts it, so
  // wait for the live sidebar to reflect it before reloading.
  await workspacePage.waitForNodeRemoved(addedNode);
  await user.page.reload();

  expect(await httpRequestFlow.get("New Request")).toBeDefined();
  await workspacePage.waitForNodeRemoved(addedNode);
});
