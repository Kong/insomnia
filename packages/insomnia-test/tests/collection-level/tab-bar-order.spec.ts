import { test } from "@package/misc/fixtures";
import { expect } from "@playwright/test";

import { createFixture } from "./support";

test("Collection shows Auth, Headers, Scripts, Environment and Docs tabs after Spec", async ({ user }) => {
  const { collectionFlow } = user.flowManager;
  const { collection } = await createFixture(user.flowManager);

  // "Tests" is absent: the legacy-tests setting is off and the collection has no legacy tests.
  expect(await collectionFlow.getTabNames(collection)).toEqual([
    "Spec",
    "Auth",
    "Headers",
    "Scripts",
    "Environment",
    "Docs",
  ]);
});
