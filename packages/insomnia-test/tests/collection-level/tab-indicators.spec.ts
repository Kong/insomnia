import { test } from "@package/misc/fixtures";
import { expect } from "@playwright/test";

import { createFixture } from "./support";

test("Tab indicators reflect state (auth dot, headers count, scripts dot)", async ({ user }) => {
  const { collectionFlow } = user.flowManager;
  const { collection } = await createFixture(user.flowManager);
  const collectionPage = await collectionFlow.open(collection);

  await collectionPage.expectIndicators({ auth: false, headers: 0, scripts: false });

  await collectionFlow.setBasicAuth(collection, { username: "user", password: "pass" });
  await collectionFlow.setHeaders(collection, [
    { name: "x-one", value: "1" },
    { name: "x-two", value: "2" },
    { name: "x-off", value: "3", disabled: true },
  ]);
  await collectionFlow.setScripts(collection, { preRequest: "console.log('pre');" });
  // The badge counts enabled headers only.
  await collectionPage.expectIndicators({ auth: true, headers: 2, scripts: true });

  await collectionFlow.clearAuth(collection);
  await collectionFlow.setHeaders(collection, []);
  await collectionFlow.setScripts(collection, { preRequest: "" });
  await collectionPage.expectIndicators({ auth: false, headers: 0, scripts: false });
  expect(await collectionPage.getHeadersBadge()).toBe(0);
});
