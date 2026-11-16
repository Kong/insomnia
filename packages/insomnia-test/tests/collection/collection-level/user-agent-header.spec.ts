import { test } from "@package/misc/fixtures";
import { expect } from "@playwright/test";

import { createFixture } from "./support";

test("Collection-level User-Agent header suppresses the default User-Agent", async ({ user }) => {
  const { collectionFlow } = user.flowManager;
  const { collection, request } = await createFixture(user.flowManager);

  let response = await user.flowManager.httpRequestFlow.send(request);
  expect(response.statusBar.code).toBe(200);
  let headers = (response.preview as { headers: Record<string, string> }).headers;
  expect(headers["user-agent"]).toMatch(/^insomnia\//);

  await collectionFlow.setHeaders(collection, [{ name: "User-Agent", value: "custom" }]);
  response = await user.flowManager.httpRequestFlow.send(request);
  expect(response.statusBar.code).toBe(200);
  headers = (response.preview as { headers: Record<string, string> }).headers;
  expect(headers["user-agent"]).toBe("custom");

  await collectionFlow.setHeaders(collection, [{ name: "User-Agent", value: "custom", disabled: true }]);
  response = await user.flowManager.httpRequestFlow.send(request);
  expect(response.statusBar.code).toBe(200);
  headers = (response.preview as { headers: Record<string, string> }).headers;
  expect(headers["user-agent"]).toBeUndefined();

  await collectionFlow.setHeaders(collection, []);
  response = await user.flowManager.httpRequestFlow.send(request);
  expect(response.statusBar.code).toBe(200);
  headers = (response.preview as { headers: Record<string, string> }).headers;
  expect(headers["user-agent"]).toMatch(/^insomnia\//);
});
