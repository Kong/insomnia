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

// Every Cloud Sync workspace used to share one VCS singleton, so creating a sibling
// collection Y could repoint the singleton's `_backendProject` mid-flight,
// while workspace X's `pull()` was still awaiting a network response. X's
// query then resumes addressed to Y instead. Only `pull()` reproduces this
// (`push()` never writes locally, so a stalled `push()` has nothing to
// corrupt) — see `reference.md`'s `cloudSyncFlow` section for the full
// mechanism and how this was verified against the pre-fix commit.
//
// Pre-fix, the redirected query just comes back empty (Y is unregistered in
// the mock's seed data) — X's blob count never increases, and neither
// project's snapshot `state[]` ever gains the other's `key`. So the real
// regression signal is the `expect.poll` timeout below, backed by a direct
// check that X's queries kept carrying X's own project id throughout.
//
// The stall is a mock-server-side hold (`setCloudSyncGraphQLDelay()`), not a
// Playwright network route — Cloud Sync's GraphQL calls run in the Electron
// main process, unreachable from renderer-side interception. Scoped to X's
// project id: an unscoped delay also stalls Y's own creation push (confirmed
// live: ballooned an unrelated "New Collection" from ~200ms to ~48s).
test.afterAll(async () => {
  await setCloudSyncGraphQLDelay(0);
  await fetch(`${MOCK_API_SERVER}/_admin/cloud-sync/new-commit`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled: false, sessionId: SESSION_ID }),
  });
  await resetCloudSyncState();
});

test("Verify creating a new collection does not misattribute a concurrent pull's blobs/snapshots to the wrong workspace", async ({
  user,
}) => {
  const { workspaceFlow, appFlow, cloudSyncFlow } = user.flowManager;
  const { cloudSyncPage } = user.pageManager;

  // "My Collection R1" is a regular (scope: "collection") fixture workspace
  // `misc/mock-api.js` can simulate a new remote commit for — see
  // `CLOUD_SYNC_NEW_COMMIT_SNAPSHOTS`.
  await cloudSyncFlow.fetch("My Collection R1");
  const workspaceX = await workspaceFlow.get({ name: "My Collection R1" });
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
        return { backendProjectId: meta.id as string, dir };
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
    // Defensive only — unlike `blobs/`, `insomnia-vcs` doesn't actually nest
    // `snapshots/` under any subdirectory, but filter to `.json` files anyway
    // in case that ever changes.
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

  // Make X's remote have a new commit, then surface it the same way
  // `pull-remote-changes.spec.ts` does — a focus change triggers X's
  // background "check for remote changes", after which "Pull" appears.
  await fetch(`${MOCK_API_SERVER}/_admin/cloud-sync/new-commit`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      enabled: true,
      sessionId: SESSION_ID,
      projectId: "proj_5145140e072d4007a30bfa6630ddae70",
    }),
  });
  await cloudSyncPage.reselect("My Collection R1");
  await appFlow.simulateMainWindowFocusChange();
  await cloudSyncPage.waitForPullAvailable();

  // Stall X's upcoming pull responses, then click "Pull" — the click itself
  // resolves fast, so the fetch-then-store-locally chain keeps running in
  // the background, stalled mid-network-call by the time this returns.
  const requestLogBeforePull = (await getCloudSyncGraphQLRequestLog()).length;
  await setCloudSyncGraphQLDelay(6000, xBefore!.backendProjectId);
  await cloudSyncPage.clickPull();

  // While X's pull is stalled, create a brand-new sibling collection Y under
  // the same shared Team Project — entirely local, so it runs to completion
  // well inside X's stalled window.
  const collectionYName = `Y ${faker.string.alphanumeric(8)}`;
  const collectionY = await workspaceFlow.create(
    project!,
    new Collection(collectionYName),
  );

  // Release X's pull and wait for its local writes to actually land — a
  // toast/UI signal isn't reliable here since creating Y navigates away from
  // X's page, so poll the blob store directly instead.
  await setCloudSyncGraphQLDelay(0);
  await expect
    .poll(async () => countBlobFiles(xBefore!.dir), { timeout: 15_000 })
    .toBeGreaterThan(xBlobCountBefore);

  const xAfter = await readProjectMeta(workspaceX!.id!);
  const yAfter = await readProjectMeta(collectionY!.id!);
  const xSnapshotState = await readLatestSnapshotState(xAfter!.dir);
  const ySnapshotState = await readLatestSnapshotState(yAfter!.dir);

  // Every `snapshots`/`blobs` query X's pull made while stalled must still
  // carry X's own project id — the direct, on-the-wire regression signal.
  // `branch` is excluded: creating Y triggers its own `push()`, which
  // legitimately queries `branch` scoped to Y's id.
  const pullRequestLog = (await getCloudSyncGraphQLRequestLog()).slice(
    requestLogBeforePull,
  );
  const xPullQueries = pullRequestLog.filter((entry) =>
    ["snapshots", "blobs"].includes(entry.operationName),
  );
  expect(xPullQueries.length).toBeGreaterThan(0);
  expect(
    xPullQueries.every(
      (entry) => entry.projectId === xBefore!.backendProjectId,
    ),
  ).toBe(true);

  expect(xAfter?.backendProjectId).toBe(xBefore?.backendProjectId);
  expect(xSnapshotState.some((entry) => entry.key === workspaceX!.id)).toBe(
    true,
  );
  expect(xSnapshotState.some((entry) => entry.key === collectionY!.id)).toBe(
    false,
  );
  expect(ySnapshotState.some((entry) => entry.key === workspaceX!.id)).toBe(
    false,
  );
});
