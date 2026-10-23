import * as fs from "node:fs";
import path from "node:path";

import { DeleteMode } from "../../enums/delete-mode";
import { expect, resetCloudSyncState, test } from "../../misc/fixtures";

test.afterAll(async () => {
  await resetCloudSyncState();
});

test("Verify deleting a synced Cloud Sync workspace archives its own backend project directly, without first re-creating it", async ({
  user,
}) => {
  const { workspaceFlow, cloudSyncFlow, appFlow } = user.flowManager;
  const { cloudSyncPage } = user.pageManager;

  await cloudSyncFlow.fetch("My Environment");
  const workspace = await workspaceFlow.get({ name: "My Environment" });
  const dataPath = await appFlow.getDataPath();
  const projectsDir = path.join(dataPath, "version-control", "projects");
  const projectDirs = await fs.promises.readdir(projectsDir);
  let backendProjectId: string | undefined;
  for (const dir of projectDirs) {
    const meta = JSON.parse(
      await fs.promises.readFile(
        path.join(projectsDir, dir, "meta.json"),
        "utf8",
      ),
    );
    if (meta.rootDocumentId === workspace!.id) {
      backendProjectId = meta.id;
      break;
    }
  }
  await cloudSyncPage.backToAllProjects();

  const logLines = await appFlow.captureMainProcessLog(async () => {
    await cloudSyncFlow.delete("My Environment", DeleteMode.Full);
  });

  const createdBackendProjectLines = logLines.filter((line) =>
    /Created backend project/.test(line),
  );
  const archivedRemoteProjectLines = logLines.filter((line) =>
    /Archived remote project/.test(line),
  );

  expect(createdBackendProjectLines).toHaveLength(0);
  expect(archivedRemoteProjectLines.length).toBeGreaterThan(0);
  expect(
    archivedRemoteProjectLines.some((line) => line.includes(backendProjectId!)),
  ).toBe(true);
});
