import * as fs from "node:fs";
import path from "node:path";

import { faker } from "@faker-js/faker";

import { HttpMethod } from "../../enums/http-method";
import { SyncStatus } from "../../enums/sync-status";
import { expect, HTTP_SERVER, test } from "../../misc/fixtures";
import { Collection } from "../../models/collection";

test("Verify a new collection is not left in an unsynced state after an app restart", async ({
  user,
}) => {
  const { workspaceFlow, httpRequestFlow, cloudSyncFlow, appFlow } =
    user.flowManager;
  const { cloudSyncPage } = user.pageManager;

  await cloudSyncFlow.fetch("My MCP Client");
  const project = await workspaceFlow.getProject({
    name: "Personal Workspace",
  });

  const collectionYName = `Y ${faker.string.alphanumeric(8)}`;
  let collectionYId: string | undefined;
  const creationLog = await appFlow.captureMainProcessLog(async () => {
    const collectionY = await workspaceFlow.create(
      project!,
      new Collection(collectionYName),
    );
    collectionYId = collectionY!.id;
    const requestName = faker.string.alphanumeric(10);
    await httpRequestFlow.create(collectionY as Collection, {
      name: requestName,
      url: `${HTTP_SERVER}/get`,
      method: HttpMethod.Get,
    });
    await cloudSyncFlow.commitAndPush(requestName, faker.lorem.sentence());
  });

  const syncedBeforeRestart = await cloudSyncPage.isSynced(collectionYName);

  const restartLog = await appFlow.captureMainProcessLog(async () => {
    await appFlow.restart();
  });

  await workspaceFlow.getProject({ name: "Personal Workspace" });
  const syncedAfterRestart = await cloudSyncPage.isSynced(collectionYName);

  const dataPath = await appFlow.getDataPath();
  const projectsDir = path.join(dataPath, "version-control", "projects");
  const dirs = await fs.promises.readdir(projectsDir);
  const matchingDirs: string[] = [];
  for (const dir of dirs) {
    const meta = JSON.parse(
      await fs.promises.readFile(
        path.join(projectsDir, dir, "meta.json"),
        "utf8",
      ),
    );
    if (meta.rootDocumentId === collectionYId) {
      matchingDirs.push(dir);
    }
  }

  const combinedLog = [...creationLog, ...restartLog].join("\n");

  expect(syncedBeforeRestart).toBe(SyncStatus.Synced);
  expect(syncedAfterRestart).toBe(SyncStatus.Synced);
  expect(combinedLog).not.toMatch(/Already up to date/);
  expect(matchingDirs).toHaveLength(1);
});
