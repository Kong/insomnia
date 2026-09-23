import * as fs from "node:fs";
import path from "node:path";

import { expect, test } from "../../misc/fixtures";

test("Verify Main Process Backs Up NeDB Files On Launch", async ({
  user,
}) => {
  const { appFlow } = user.flowManager;

  const dataPath = await appFlow.getDataPath();

  let backupFiles: string[] = [];
  await expect(async () => {
    const backupsDir = path.join(dataPath, "backups");
    const versions = fs.readdirSync(backupsDir);
    expect(versions.length).toBeGreaterThan(0);
    backupFiles = fs.readdirSync(path.join(backupsDir, versions[0]));
    expect(backupFiles.length).toBeGreaterThan(0);
  }).toPass({ timeout: 15_000 });

  expect(backupFiles).toContain("insomnia.Project.db");
});
