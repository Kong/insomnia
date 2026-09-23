import * as fs from "node:fs";
import * as path from "node:path";

import { faker } from "@faker-js/faker";

import {
  expect,
  getCloudSyncGraphQLRequestLog,
  MOCK_API_SERVER,
  resetCloudSyncState,
  SESSION_ID,
  setCloudSyncGraphQLDelay,
  test,
} from "../../misc/fixtures";
import { Collection } from "../../models/collection";

test.afterAll(async () => {
  await setCloudSyncGraphQLDelay(0);
  await fetch(`${MOCK_API_SERVER}/_admin/cloud-sync/new-commit`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled: false, sessionId: SESSION_ID }),
  });
  await resetCloudSyncState();
});

test("Verify an unrelated action during collection creation is equally safe", async ({
  user,
}) => {
  const { workspaceFlow, cloudSyncFlow, appFlow } = user.flowManager;
  const { cloudSyncPage } = user.pageManager;

  await cloudSyncFlow.fetch("My Environment");
  const workspaceX = await workspaceFlow.get({ name: "My Environment" });
  const project = await workspaceFlow.getProject({
    name: "Personal Workspace",
  });

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
        return {
          rootDocumentId: meta.rootDocumentId as string,
          backendProjectId: meta.id as string,
          dir,
        };
      }
    }
    return;
  };
  const countBlobFiles = async (dir: string) => {
    const blobsDir = path.join(projectsDir, dir, "blobs");
    let total = 0;
    for (const prefix of await fs.promises.readdir(blobsDir)) {
      total += (await fs.promises.readdir(path.join(blobsDir, prefix))).length;
    }
    return total;
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

  const xBefore = await readProjectMeta(workspaceX!.id!);
  const xBlobCountBefore = await countBlobFiles(xBefore!.dir);

  await fetch(`${MOCK_API_SERVER}/_admin/cloud-sync/new-commit`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled: true, sessionId: SESSION_ID }),
  });
  await cloudSyncPage.reselect("My Environment");
  await appFlow.simulateMainWindowFocusChange();
  await cloudSyncPage.waitForPullAvailable();

  const requestLogBeforePull = (await getCloudSyncGraphQLRequestLog()).length;
  await setCloudSyncGraphQLDelay(6000, xBefore!.backendProjectId);
  await cloudSyncPage.clickPull();

  const renamedXName = `X ${faker.string.alphanumeric(8)}`;
  await workspaceFlow.rename(workspaceX!, renamedXName);
  const collectionYName = `Y ${faker.string.alphanumeric(8)}`;
  const collectionY = await workspaceFlow.create(
    project!,
    new Collection(collectionYName),
  );

  await setCloudSyncGraphQLDelay(0);
  await expect
    .poll(async () => countBlobFiles(xBefore!.dir), { timeout: 15_000 })
    .toBeGreaterThan(xBlobCountBefore);

  const xAfter = await readProjectMeta(workspaceX!.id!);
  const yAfter = await readProjectMeta(collectionY!.id!);
  const xState = await readLatestSnapshotState(xAfter!.dir);
  const yState = await readLatestSnapshotState(yAfter!.dir);
  const renamedX = await workspaceFlow.get({ name: renamedXName });
  const pullRequestLog = (await getCloudSyncGraphQLRequestLog()).slice(
    requestLogBeforePull,
  );
  const xPullQueries = pullRequestLog.filter((entry) =>
    ["snapshots", "blobs"].includes(entry.operationName),
  );

  expect(renamedX?.id).toBe(workspaceX!.id);
  expect(xPullQueries.length).toBeGreaterThan(0);
  expect(
    xPullQueries.every(
      (entry) => entry.projectId === xBefore!.backendProjectId,
    ),
  ).toBe(true);
  expect(xAfter?.backendProjectId).toBe(xBefore?.backendProjectId);
  expect(xState.some((entry) => entry.key === workspaceX!.id)).toBe(true);
  expect(xState.some((entry) => entry.key === collectionY!.id)).toBe(false);
  expect(yState.some((entry) => entry.key === workspaceX!.id)).toBe(false);
  expect(yState.filter((entry) => entry.key.startsWith("wrk_"))).toHaveLength(
    1,
  );
});
