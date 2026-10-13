import { faker } from "@faker-js/faker";

import { HttpMethod } from "../../enums/http-method";
import {
  DEFAULT_TIMEOUT,
  expect,
  HTTP_SERVER,
  test,
} from "../../misc/fixtures";
import type { Collection } from "../../models/collection";

test("Verify restoring an earlier snapshot removes a request added and committed after it on a Cloud-synced workspace", async ({
  user,
}) => {
  const { workspaceFlow, httpRequestFlow, cloudSyncFlow } = user.flowManager;

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
  await cloudSyncFlow.commit(addedName, faker.lorem.sentence());

  await cloudSyncFlow.restoreSnapshot("Initial Snapshot");
  await user.page.reload();

  await expect
    .poll(() => httpRequestFlow.get(addedName, collection), {
      timeout: DEFAULT_TIMEOUT,
    })
    .toBeUndefined();
  expect(await httpRequestFlow.get("New Request", collection)).toBeDefined();
});
