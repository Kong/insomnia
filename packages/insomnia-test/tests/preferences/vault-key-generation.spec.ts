import { test } from "@package/misc/fixtures";
import { expect } from "@playwright/test";

test("Verify a new vault key can be generated and persists across reopening Preferences", async ({
  user,
}) => {
  const { preferencesFlow } = user.flowManager;

  const generatedKey = await preferencesFlow.generateVaultKey();

  const { preferences, preferencesVault } = user.pageManager;
  await preferences.open();
  const redisplayedKey = await preferencesVault.getVaultKey();
  await preferences.close();

  expect(generatedKey.length).toBeGreaterThan(0);
  expect(redisplayedKey).toBe(generatedKey);
});
