import { test } from "@package/misc/fixtures";
import { expect } from "@playwright/test";

import { createFixture, sendAndReadHeaders } from "./support";

test("Collection-level headers are sent with a request", async ({ user }) => {
  const { collectionFlow } = user.flowManager;
  const { collection, request } = await createFixture(user.flowManager);

  await collectionFlow.setHeaders(collection, [{ name: "x-collection", value: "c" }]);

  const headers = await sendAndReadHeaders(user.flowManager, request);
  expect(headers["x-collection"]).toBe("c");

  const collectionPage = await collectionFlow.open(collection);
  expect(await collectionPage.getHeadersBadge()).toBe(1);
});
