import { expect, test } from "../../misc/fixtures";

test("Verify a new vault key can be generated and persists across reopening Preferences", async ({
  user,
}) => {
  const { preferencesFlow } = user.flowManager;

  const generatedKey = await preferencesFlow.generateVaultKey();

  const { preferencesPage } = user.pageManager;
  await preferencesPage.open();
  const redisplayedKey = await preferencesPage.getVaultKey();
  await preferencesPage.close();

  expect(generatedKey.length).toBeGreaterThan(0);
  expect(redisplayedKey).toBe(generatedKey);
});
