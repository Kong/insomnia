import { test } from "@package/misc/fixtures";
import { expect } from "@playwright/test";

import { createFixture } from "./support";

test("Collection shows Auth, Headers, Scripts, Environment and Docs tabs after Spec", async ({ user }) => {
  const { collectionFlow } = user.flowManager;
  const { collection } = await createFixture(user.flowManager);

  expect(await collectionFlow.getTabNames(collection)).toEqual([
    "Spec",
    "Auth",
    "Headers",
    "Scripts",
    "Environment",
    "Docs",
  ]);
});
