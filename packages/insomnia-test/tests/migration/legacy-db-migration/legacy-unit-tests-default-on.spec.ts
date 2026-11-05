import * as fs from "node:fs";
import path from "node:path";

import { test } from "@package/misc/fixtures";
import { expect } from "@playwright/test";

const LEGACY_DB_DIR = path.join(import.meta.dirname, "insomnia-legacy-db");

const testWithLegacyDatabase = test.extend({
  dataPath: async ({ dataPath }, use) => {
    await fs.promises.mkdir(dataPath, { recursive: true });
    for (const file of await fs.promises.readdir(LEGACY_DB_DIR)) {
      await fs.promises.copyFile(
        path.join(LEGACY_DB_DIR, file),
        path.join(dataPath, file),
      );
    }
    await use(dataPath);
  },
});

testWithLegacyDatabase(
  "Verify the legacy unit test setting defaults off and lists the existing suite for a profile that already has one",
  async ({ user }) => {
    const { workspaceFlow } = user.flowManager;
    const { preferences } = user.pageManager;

    await preferences.open();
    const disableByDefault =
      await preferences.isShowLegacyUnitTestsEnabled();
    await preferences.close();

    const designDocument = await workspaceFlow.getCollectionSpec(
      "Local Design Document",
    );
    const suiteNames = await workspaceFlow.getTestSuiteNames(designDocument!);

    expect(disableByDefault).toBe(false);
    expect(suiteNames).toContain("Existing Suite");
  },
);
