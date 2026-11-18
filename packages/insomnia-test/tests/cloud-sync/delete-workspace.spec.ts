import { DeleteMode } from "@package/enums/delete-mode";
import { SyncStatus } from "@package/enums/sync-status";
import { DEFAULT_TIMEOUT, resetCloudSyncState, test } from "@package/misc/fixtures";
import { expect } from "@playwright/test";

test.afterAll(async () => {
  await resetCloudSyncState();
});

test("Verify deleting a Cloud-synced workspace removes it from the local sidebar, whether keeping or fully deleting its remote copy", async ({
  user,
}) => {
  const { cloudSyncFlow } = user.flowManager;
  const { cloudSyncPage } = user.pageManager;

  await cloudSyncFlow.fetch("My Collection R1");
  await cloudSyncPage.backToAllProjects();
  await cloudSyncFlow.delete("My Collection R1", DeleteMode.Local);

  await cloudSyncFlow.fetch("My MCP Client");
  await cloudSyncPage.backToAllProjects();
  await cloudSyncFlow.delete("My MCP Client", DeleteMode.Full);

  await expect
    .poll(() => cloudSyncPage.isSynced("My Collection R1"), {
      timeout: DEFAULT_TIMEOUT,
    })
    .toBe(SyncStatus.Unsynced);
  await expect
    .poll(() => cloudSyncPage.isSynced("My MCP Client"), {
      timeout: DEFAULT_TIMEOUT,
    })
    .toBe(undefined);
});
