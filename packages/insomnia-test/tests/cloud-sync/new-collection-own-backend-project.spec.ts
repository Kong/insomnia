import * as fs from "node:fs";
import path from "node:path";

import { faker } from "@faker-js/faker";

import { HttpMethod } from "../../enums/http-method";
import { SyncStatus } from "../../enums/sync-status";
import { expect, HTTP_SERVER, test } from "../../misc/fixtures";
import { Collection } from "../../models/collection";

test("Verify a new collection commits and pushes under its own backend project", async ({
  user,
}) => {
  const { workspaceFlow, httpRequestFlow, cloudSyncFlow, appFlow } =
    user.flowManager;
  const { cloudSyncPage } = user.pageManager;

  await cloudSyncFlow.fetch("My Environment");
  const workspaceX = await workspaceFlow.get({ name: "My Environment" });
  const project = await workspaceFlow.getProject({
    name: "Personal Workspace",
  });

  const collectionYName = `Y ${faker.string.alphanumeric(8)}`;
  const collectionY = await workspaceFlow.create(
    project!,
    new Collection(collectionYName),
  );
  const requestName = faker.string.alphanumeric(10);
  await httpRequestFlow.create(collectionY as Collection, {
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

  const yMeta = await readProjectMeta(collectionY!.id!);
  const yState = await readLatestSnapshotState(yMeta!.dir);
  const yWorkspaceEntries = yState.filter((entry) =>
    entry.key.startsWith("wrk_"),
  );
  const syncStatus = await cloudSyncPage.isSynced(collectionYName);

  expect(yWorkspaceEntries).toHaveLength(1);
  expect(yWorkspaceEntries[0]!.key).toBe(collectionY!.id);
  expect(yMeta!.rootDocumentId).toBe(collectionY!.id);
  expect(yState.some((entry) => entry.key === workspaceX!.id)).toBe(false);
  expect(syncStatus).toBe(SyncStatus.Synced);
});
