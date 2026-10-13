import * as crypto from "node:crypto";

import { expect, test } from "../../misc/fixtures";

const testWithVaultSalt = test.extend({
  vaultSalt: async ({}, use) => {
    await use(crypto.randomBytes(32).toString("hex"));
  },
});

testWithVaultSalt(
  "Verify entering an invalid vault key shows an error and Reset Vault Key issues a new one",
  async ({ user }) => {
    const { preferencesFlow } = user.flowManager;

    const invalidKeyError =
      await preferencesFlow.enterVaultKey("invalidVaultKey");
    const resetKey = await preferencesFlow.resetVaultKey();

    const { preferencesPage } = user.pageManager;
    await preferencesPage.open();
    const displayedKey = await preferencesPage.getVaultKey();
    await preferencesPage.close();

    expect(invalidKeyError).toBe(
      "Invalid vault key, please check and input again",
    );
    expect(resetKey.length).toBeGreaterThan(0);
    expect(resetKey).not.toBe("invalidVaultKey");
    expect(displayedKey).toBe(resetKey);
  },
);
