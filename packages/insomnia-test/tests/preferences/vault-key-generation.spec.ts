import { test } from "@package/misc/fixtures";
import { expect } from "@playwright/test";

test("Verify a new vault key can be generated and persists across reopening Preferences", async ({
  user,
}) => {
  const { preferencesFlow } = user.flowManager;

  const generatedKey = await preferencesFlow.generateVaultKey();

  const { preferencesPage, preferencesVaultPage } = user.pageManager;
  await preferencesPage.open();
  const redisplayedKey = await preferencesVaultPage.getVaultKey();
  await preferencesPage.close();

  expect(generatedKey.length).toBeGreaterThan(0);
  expect(redisplayedKey).toBe(generatedKey);
});
