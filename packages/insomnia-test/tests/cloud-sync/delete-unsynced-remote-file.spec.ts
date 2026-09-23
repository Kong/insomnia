import * as fs from "node:fs";
import path from "node:path";

import { faker } from "@faker-js/faker";

import { HttpMethod } from "../../enums/http-method";
import {
  expect,
  getCloudSyncProjectInfo,
  HTTP_SERVER,
  resetCloudSyncState,
  setCloudSyncArchiveFailure,
  test,
} from "../../misc/fixtures";
import { Collection } from "../../models/collection";

test.afterAll(async () => {
  await resetCloudSyncState();
});

test("Verify the dashboard can delete a never-pulled unsynced remote file and a pre-existing mismatched ghost entry alike, without repairing the mismatch, surfaces a clean error on failure, and doesn't cause a newly created collection to develop its own mismatch", async ({
  user,
}) => {
  const { workspaceFlow, httpRequestFlow, cloudSyncFlow, appFlow } =
    user.flowManager;
  const { cloudSyncPage } = user.pageManager;

  const project = await workspaceFlow.getProject({
    name: "Personal Workspace",
  });
  await cloudSyncFlow.openProjectDashboard(project!);

  const mcpClientInfoBefore = await getCloudSyncProjectInfo("My MCP Client");
  await cloudSyncPage.openFileDeleteDialog("My MCP Client");
  const deleteDialogText = await cloudSyncPage.getFileDeleteDialogText();
  const logLines = await appFlow.captureMainProcessLog(async () => {
    await cloudSyncPage.confirmFileDelete();
    await expect
      .poll(() => cloudSyncPage.isFileCardVisible("My MCP Client"))
      .toBe(false);
  });
  const mcpClientInfoAfter = await getCloudSyncProjectInfo("My MCP Client");

  const ghostInfoBefore = await getCloudSyncProjectInfo("Ghost Collection");
  await cloudSyncFlow.deleteUnsyncedFile("Ghost Collection");
  await expect
    .poll(() => cloudSyncPage.isFileCardVisible("Ghost Collection"))
    .toBe(false);
  const ghostInfoAfter = await getCloudSyncProjectInfo("Ghost Collection");

  await setCloudSyncArchiveFailure(true);
  await cloudSyncFlow.deleteUnsyncedFile("My Environment");
  await cloudSyncPage.waitForFileDeleteFailureToast("My Environment");
  const environmentStillVisible =
    await cloudSyncPage.isFileCardVisible("My Environment");
  const environmentInfoAfterFailure =
    await getCloudSyncProjectInfo("My Environment");
  await setCloudSyncArchiveFailure(false);

  const newCollectionName = `Z ${faker.string.alphanumeric(8)}`;
  const newCollection = await workspaceFlow.create(
    project!,
    new Collection(newCollectionName),
  ) as Collection;
  const requestName = faker.string.alphanumeric(10);
  await httpRequestFlow.create(newCollection, {
    name: requestName,
    url: `${HTTP_SERVER}/get`,
    method: HttpMethod.Get,
  });
  await cloudSyncFlow.commitAndPush(requestName, faker.lorem.sentence());

  const dataPath = await appFlow.getDataPath();
  const projectsDir = path.join(dataPath, "version-control", "projects");
  const readProjectMeta = async (workspaceId: string) => {
    const dirs = await fs.promises.readdir(projectsDir);
    for (const dir of dirs) {
      const meta = JSON.parse(
        await fs.promises.readFile(
          path.join(projectsDir, dir, "meta.json"),
          "utf8",
        ),
      );
      if (meta.rootDocumentId === workspaceId) {
        return { rootDocumentId: meta.rootDocumentId as string, dir };
      }
    }
    return;
  };
  const readLatestSnapshotState = async (dir: string) => {
    const snapshotsDir = path.join(projectsDir, dir, "snapshots");
    const files = (await fs.promises.readdir(snapshotsDir)).filter((file) =>
      file.endsWith(".json"),
    );
    const snapshots = await Promise.all(
      files.map(async (file) =>
        JSON.parse(
          await fs.promises.readFile(path.join(snapshotsDir, file), "utf8"),
        ),
      ),
    );
    snapshots.sort(
      (a, b) => new Date(b.created).getTime() - new Date(a.created).getTime(),
    );
    return snapshots[0].state as { key: string; name: string }[];
  };
  const newCollectionMeta = await readProjectMeta(newCollection!.id!);
  const newCollectionState = await readLatestSnapshotState(
    newCollectionMeta!.dir,
  );
  const newCollectionWorkspaceEntries = newCollectionState.filter((entry) =>
    entry.key.startsWith("wrk_"),
  );

  expect(deleteDialogText).toContain("Delete file");
  expect(deleteDialogText).toContain("My MCP Client");
  expect(deleteDialogText).toContain("permanently delete");
  expect(deleteDialogText).toContain("Cloud for everyone");
  expect(deleteDialogText).toContain("cannot undo this action");
  expect(logLines.some((line) => /Created backend project/.test(line))).toBe(
    false,
  );
  expect(
    logLines.some(
      (line) =>
        /Archived remote project/.test(line) &&
        line.includes(mcpClientInfoBefore.id),
    ),
  ).toBe(true);
  expect(mcpClientInfoBefore.deleted).toBe(false);
  expect(mcpClientInfoAfter.deleted).toBe(true);
  expect(ghostInfoBefore.rootDocumentId).not.toBe(
    ghostInfoBefore.latestSnapshotWorkspaceKey,
  );
  expect(ghostInfoBefore.deleted).toBe(false);
  expect(ghostInfoAfter.deleted).toBe(true);
  expect(ghostInfoAfter.rootDocumentId).toBe(ghostInfoBefore.rootDocumentId);
  expect(ghostInfoAfter.latestSnapshotWorkspaceKey).toBe(
    ghostInfoBefore.latestSnapshotWorkspaceKey,
  );
  expect(environmentStillVisible).toBe(true);
  expect(environmentInfoAfterFailure.deleted).toBe(false);
  expect(newCollectionWorkspaceEntries).toHaveLength(1);
  expect(newCollectionWorkspaceEntries[0]!.key).toBe(newCollection!.id);
  expect(newCollectionMeta!.rootDocumentId).toBe(newCollection!.id);
});
