import {
  expect,
  MOCK_API_SERVER,
  SESSION_ID,
  test,
} from "../../misc/fixtures";

test("Verify a new remote commit becomes pullable on a Cloud-synced workspace after a main-window focus change", async ({
  user,
}) => {
  const { cloudSyncFlow, appFlow } = user.flowManager;
  const { cloudSyncPage } = user.pageManager;

  await cloudSyncFlow.fetch("My Environment");
  await fetch(`${MOCK_API_SERVER}/_admin/cloud-sync/new-commit`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled: true, sessionId: SESSION_ID }),
  });
  await cloudSyncPage.reselect("My Environment");
  await appFlow.simulateMainWindowFocusChange();
  const pullLabel = await cloudSyncPage.waitForPullAvailable();
  await cloudSyncPage.closeSyncMenu();

  await fetch(`${MOCK_API_SERVER}/_admin/cloud-sync/new-commit`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled: false, sessionId: SESSION_ID }),
  });

  expect(pullLabel).toMatch(/Pull 1 Commit/);
});
