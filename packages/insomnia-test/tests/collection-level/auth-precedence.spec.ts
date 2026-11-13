import { test } from "@package/misc/fixtures";
import { expect } from "@playwright/test";

import { basicAuthHeader, createFixture, sendAndReadHeaders } from "./support";

test("Request auth overrides folder auth, which overrides collection auth", async ({ user }) => {
  const { collectionFlow, folderFlow, httpRequestFlow } = user.flowManager;
  const { collection, folders, request } = await createFixture(user.flowManager, { folderDepth: 1 });

  await collectionFlow.setBasicAuth(collection, { username: "collection-user", password: "collection-pass" });
  const folderPage = await folderFlow.open(folders[0]);
  await folderPage.auth.setBearerFields({ token: "folder-token" });

  // 1. The request has no auth of its own: the folder's Bearer token wins over the collection's Basic.
  let headers = await sendAndReadHeaders(user.flowManager, request);
  expect(headers.authorization).toBe("Bearer folder-token");

  // 2. The request's own API Key wins over both.
  await httpRequestFlow.get(request);
  const requestPage = user.pageManager.httpRequestPage;
  await requestPage.auth.setApiKeyFields({ key: "x-api-key", value: "request-key" });
  headers = await sendAndReadHeaders(user.flowManager, request);
  expect(headers["x-api-key"]).toBe("request-key");
  expect(headers.authorization).toBeUndefined();

  // 3. A disabled request and folder auth are skipped, leaving the collection's Basic.
  await httpRequestFlow.get(request);
  await requestPage.auth.setEnabled(false);
  await (await folderFlow.open(folders[0])).auth.setEnabled(false);
  headers = await sendAndReadHeaders(user.flowManager, request);
  expect(headers["x-api-key"]).toBeUndefined();
  expect(headers.authorization).toBe(basicAuthHeader("collection-user", "collection-pass"));
});
