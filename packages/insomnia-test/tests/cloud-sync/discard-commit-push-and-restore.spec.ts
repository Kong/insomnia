import { faker } from "@faker-js/faker";

import { ContentType } from "../../enums/content-type";
import { DEFAULT_TIMEOUT, expect, test } from "../../misc/fixtures";

test("Verify discarding changes, committing and pushing, and restoring an earlier snapshot on a Cloud-synced workspace", async ({
  user,
}) => {
  const { workspaceFlow, httpRequestFlow, cloudSyncFlow } = user.flowManager;
  const { httpRequestPage, cloudSyncPage } = user.pageManager;

  await cloudSyncFlow.fetch("My Collection R1");
  const collection = await workspaceFlow.getCollection({
    name: "My Collection R1",
  });
  await httpRequestFlow.get("New Request", collection);
  await httpRequestPage.setBody({
    mimeType: ContentType.Plain,
    text: faker.lorem.slug(),
  });
  await cloudSyncFlow.discardAllChanges();
  await user.page.reload();
  await httpRequestFlow.get("New Request", collection);

  await expect
    .poll(() => httpRequestPage.getBody(), { timeout: DEFAULT_TIMEOUT })
    .toEqual({ mimeType: ContentType.Plain, text: "foo=bar" });

  await httpRequestPage.setBody({
    mimeType: ContentType.Plain,
    text: faker.lorem.slug(),
  });
  await cloudSyncFlow.commitAndPush("New Request", faker.lorem.sentence());
  const isCommitDisabled = await cloudSyncPage.isCommitDisabled();

  await cloudSyncFlow.restoreSnapshot("Initial Snapshot");
  await user.page.reload();
  await httpRequestFlow.get("New Request", collection);
  const bodyAfterRestore = await httpRequestPage.getBody();

  expect(isCommitDisabled).toBe(true);
  expect(bodyAfterRestore).toBeUndefined();
});
