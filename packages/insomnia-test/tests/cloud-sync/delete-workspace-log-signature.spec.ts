import * as fs from "node:fs";
import path from "node:path";

import { DeleteMode } from "@package/enums/delete-mode";
import { readBackendProjectMetas } from "@package/misc/backend-projects";
import { resetCloudSyncState, test } from "@package/misc/fixtures";
import { expect } from "@playwright/test";

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
  const backendProjectId = (await readBackendProjectMetas(projectsDir)).find(
    (m) => m.rootDocumentId === workspace!.id,
  )?.id;
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
