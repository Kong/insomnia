import { test } from "@package/misc/fixtures";
import { expect } from "@playwright/test";

import { createFixture } from "./support";

test("Docs tab saves and restores the collection description", async ({ user }) => {
  const { collectionFlow, appFlow } = user.flowManager;
  const { collection } = await createFixture(user.flowManager);
  const docs = "# Collection docs\n\nShared by **every** request.";

  await collectionFlow.setDocs(collection, docs);

  const collectionPage = await collectionFlow.open(collection);
  await collectionPage.switchTab("headers");
  expect(await collectionFlow.getDocs(collection)).toBe(docs);

  await appFlow.restart();
  expect(await collectionFlow.getDocs(collection)).toBe(docs);
});
