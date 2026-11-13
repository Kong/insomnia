import { test } from "@package/misc/fixtures";
import { expect } from "@playwright/test";

import { createFixture, sendAndReadHeaders } from "./support";

test("Disabled collection header and empty-name header are ignored", async ({ user }) => {
  const { collectionFlow } = user.flowManager;
  const { collection, request } = await createFixture(user.flowManager);

  await collectionFlow.setHeaders(collection, [
    { name: "x-enabled", value: "yes" },
    { name: "x-disabled", value: "no", disabled: true },
    { name: "", value: "nameless-value" },
  ]);

  const headers = await sendAndReadHeaders(user.flowManager, request);
  expect(headers["x-enabled"]).toBe("yes");
  expect(headers["x-disabled"]).toBeUndefined();
  expect(Object.values(headers)).not.toContain("nameless-value");
});
