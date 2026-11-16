import { test } from "@package/misc/fixtures";
import { expect } from "@playwright/test";

import { createFixture } from "./support";

test("Collection-level User-Agent header suppresses the default User-Agent", async ({ user }) => {
  const { collectionFlow } = user.flowManager;
  const { collection, request } = await createFixture(user.flowManager);

  // Baseline: no custom header, the default Insomnia User-Agent is sent.
  let response = await user.flowManager.httpRequestFlow.send(request);
  expect(response.statusBar.code).toBe(200);
  let headers = (response.preview as { headers: Record<string, string> }).headers;
  expect(headers["user-agent"]).toMatch(/^insomnia\//);

  // 1. An enabled collection User-Agent replaces the default one.
  await collectionFlow.setHeaders(collection, [{ name: "User-Agent", value: "custom" }]);
  response = await user.flowManager.httpRequestFlow.send(request);
  expect(response.statusBar.code).toBe(200);
  headers = (response.preview as { headers: Record<string, string> }).headers;
  expect(headers["user-agent"]).toBe("custom");

  // 2. Disabling it does not bring the default back: a User-Agent header that is
  //    disabled everywhere suppresses the User-Agent altogether (`shouldSuppressUserAgent`).
  await collectionFlow.setHeaders(collection, [{ name: "User-Agent", value: "custom", disabled: true }]);
  response = await user.flowManager.httpRequestFlow.send(request);
  expect(response.statusBar.code).toBe(200);
  headers = (response.preview as { headers: Record<string, string> }).headers;
  expect(headers["user-agent"]).toBeUndefined();

  // 3. Removing the header restores the default.
  await collectionFlow.setHeaders(collection, []);
  response = await user.flowManager.httpRequestFlow.send(request);
  expect(response.statusBar.code).toBe(200);
  headers = (response.preview as { headers: Record<string, string> }).headers;
  expect(headers["user-agent"]).toMatch(/^insomnia\//);
});
