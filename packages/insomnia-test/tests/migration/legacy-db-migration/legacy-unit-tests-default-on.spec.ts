import * as fs from "node:fs";
import path from "node:path";

import { expect, test } from "../../../misc/fixtures";

const LEGACY_DB_DIR = path.join(__dirname, "insomnia-legacy-db");

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
  "Verify the legacy unit test setting defaults on and lists the existing suite for a profile that already has one",
  async ({ user }) => {
    const { workspaceFlow } = user.flowManager;
    const { preferencesPage } = user.pageManager;

    await preferencesPage.open();
    const enabledByDefault =
      await preferencesPage.isShowLegacyUnitTestsEnabled();
    await preferencesPage.close();

    const designDocument = await workspaceFlow.getCollectionSpec(
      "Local Design Document",
    );
    const suiteNames = await workspaceFlow.getTestSuiteNames(designDocument!);

    expect(enabledByDefault).toBe(true);
    expect(suiteNames).toContain("Existing Suite");
  },
);
