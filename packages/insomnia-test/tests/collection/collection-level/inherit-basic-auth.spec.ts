import { test } from "@package/misc/fixtures";
import { expect } from "@playwright/test";

import { createFixture } from "./support";

test("Collection-level Basic auth is inherited by a request", async ({ user }) => {
  const { collectionFlow } = user.flowManager;
  const { collection, request } = await createFixture(user.flowManager);

  await collectionFlow.setBasicAuth(collection, { username: "collection-user", password: "collection-pass" });

  const response = await user.flowManager.httpRequestFlow.send(request);
  expect(response.statusBar.code).toBe(200);
  const headers = (response.preview as { headers: Record<string, string> }).headers;
  expect(headers.authorization).toBe(`Basic ${Buffer.from("collection-user:collection-pass").toString("base64")}`);

  const collectionPage = await collectionFlow.open(collection);
  expect(await collectionPage.hasActiveDot("auth")).toBe(true);
});
