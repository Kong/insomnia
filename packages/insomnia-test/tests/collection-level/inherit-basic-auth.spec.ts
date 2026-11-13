import { test } from "@package/misc/fixtures";
import { expect } from "@playwright/test";

import { basicAuthHeader, createFixture, sendAndReadHeaders } from "./support";

test("Collection-level Basic auth is inherited by a request", async ({ user }) => {
  const { collectionFlow } = user.flowManager;
  const { collection, request } = await createFixture(user.flowManager);

  await collectionFlow.setBasicAuth(collection, { username: "collection-user", password: "collection-pass" });

  const headers = await sendAndReadHeaders(user.flowManager, request);
  expect(headers.authorization).toBe(basicAuthHeader("collection-user", "collection-pass"));

  const collectionPage = await collectionFlow.open(collection);
  expect(await collectionPage.hasActiveDot("auth")).toBe(true);
});
