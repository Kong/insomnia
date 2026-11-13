import { test } from "@package/misc/fixtures";
import { expect } from "@playwright/test";

import { createFixture, sendAndReadHeaders } from "./support";

test("Collection-level User-Agent header suppresses the default User-Agent", async ({ user }) => {
  const { collectionFlow } = user.flowManager;
  const { collection, request } = await createFixture(user.flowManager);

  // Baseline: no custom header, the default Insomnia User-Agent is sent.
  let headers = await sendAndReadHeaders(user.flowManager, request);
  expect(headers["user-agent"]).toMatch(/^insomnia\//);

  // 1. An enabled collection User-Agent replaces the default one.
  await collectionFlow.setHeaders(collection, [{ name: "User-Agent", value: "custom" }]);
  headers = await sendAndReadHeaders(user.flowManager, request);
  expect(headers["user-agent"]).toBe("custom");

  // 2. Disabling it does not bring the default back: a User-Agent header that is
  //    disabled everywhere suppresses the User-Agent altogether (`shouldSuppressUserAgent`).
  await collectionFlow.setHeaders(collection, [{ name: "User-Agent", value: "custom", disabled: true }]);
  headers = await sendAndReadHeaders(user.flowManager, request);
  expect(headers["user-agent"]).toBeUndefined();

  // 3. Removing the header restores the default.
  await collectionFlow.setHeaders(collection, []);
  headers = await sendAndReadHeaders(user.flowManager, request);
  expect(headers["user-agent"]).toMatch(/^insomnia\//);
});
