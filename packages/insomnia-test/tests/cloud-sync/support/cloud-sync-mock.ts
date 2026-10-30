import { MOCK_API_SERVER, SESSION_ID } from "../../../misc/fixtures";

// Test-only controls for misc/mock-api.ts's Cloud Sync GraphQL mock. The app
// calls it from the Electron main process, so a spec can't attach a header or
// intercept it from the renderer; these hold or fail the response server-side.

/**
 * Holds Cloud Sync GraphQL responses for this session by `ms` until called
 * again with `0`. With `projectId`, only requests naming that backend project
 * are held; otherwise every request is, including a new workspace's own
 * immediate push. Not cleared by `resetCloudSyncState()`.
 */
export async function setCloudSyncGraphQLDelay(
  ms: number,
  projectId?: string,
): Promise<void> {
  await fetch(`${MOCK_API_SERVER}/_admin/cloud-sync/delay`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId: SESSION_ID, ms, projectId }),
  });
}

/**
 * Every Cloud Sync GraphQL request this session has made, in arrival order.
 * `at` is stamped on arrival, before any `setCloudSyncGraphQLDelay` hold.
 * Cleared by `resetCloudSyncState()`.
 */
export async function getCloudSyncGraphQLRequestLog(): Promise<
  { operationName: string; projectId: string | null; at: number }[]
> {
  const response = await fetch(
    `${MOCK_API_SERVER}/_admin/cloud-sync/request-log?sessionId=${SESSION_ID}`,
  );
  const { requestLog } = await response.json();
  return requestLog;
}

/** Makes the `projectArchive` mutation fail for this session while `true`. */
export async function setCloudSyncArchiveFailure(
  enabled: boolean,
): Promise<void> {
  await fetch(`${MOCK_API_SERVER}/_admin/cloud-sync/archive-failure`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId: SESSION_ID, enabled }),
  });
}

/**
 * Reads back a seeded fixture project ("My Collection R1", "My Environment",
 * "My MCP Client", "Ghost Collection") by name, so a test can identify a
 * never-pulled file without a local `meta.json`.
 */
export async function getCloudSyncProjectInfo(name: string): Promise<{
  id: string;
  rootDocumentId: string;
  latestSnapshotWorkspaceKey: string | null;
  deleted: boolean;
}> {
  const response = await fetch(
    `${MOCK_API_SERVER}/_admin/cloud-sync/project-info?sessionId=${SESSION_ID}&name=${encodeURIComponent(name)}`,
  );
  return response.json();
}

/**
 * Adds a remote-only project holding `docs` verbatim (workspace first, each
 * with its own `_id`/`parentId`/`type`), fetchable via `cloudSyncFlow.fetch()`.
 * Cleared by `resetCloudSyncState()`.
 */
export async function seedCloudSyncProject(
  name: string,
  docs: { _id: string; name?: string }[],
): Promise<void> {
  await fetch(`${MOCK_API_SERVER}/_admin/cloud-sync/seed-project`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId: SESSION_ID, name, docs }),
  });
}
