import * as crypto from "node:crypto";

import { test } from "@package/misc/fixtures";
import { expect } from "@playwright/test";

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

    const { preferences, preferencesVault } = user.pageManager;
    await preferences.open();
    const displayedKey = await preferencesVault.getVaultKey();
    await preferences.close();

    expect(invalidKeyError).toBe(
      "Invalid vault key, please check and input again",
    );
    expect(resetKey.length).toBeGreaterThan(0);
    expect(resetKey).not.toBe("invalidVaultKey");
    expect(displayedKey).toBe(resetKey);
  },
);
