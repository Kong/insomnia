import { faker } from "@faker-js/faker";
import { expect } from "@playwright/test";

import { test } from "@package/misc/fixtures";
import { Collection } from "@package/models/collection";
import { DialogDismissMethod } from "@package/pages/cloud-sync-file-delete.page";

test("Verify the dashboard's unsynced-file delete button only appears on unsynced cards, is revealed on hover and keyboard focus, and cancelling its dialog leaves the file intact", async ({
  user,
}) => {
  const { workspaceFlow, cloudSyncFlow, appFlow } = user.flowManager;
  const { cloudSyncPage, cloudSyncFileDeletePage } = user.pageManager;

  const project = await workspaceFlow.getProject({ name: "Personal Workspace" });
  const localCollection = await workspaceFlow.createCollection(
    project!,
    new Collection(faker.string.alphanumeric(10)),
  );

  await cloudSyncFlow.fetch("My Collection R1");
  await cloudSyncPage.backToAllProjects();
  await cloudSyncFlow.openProjectDashboard(project!);

  const syncedHasButton = await cloudSyncFileDeletePage.hasFileDeleteButton(
    "My Collection R1",
  );
  const localOnlyHasButton = await cloudSyncFileDeletePage.hasFileDeleteButton(
    (localCollection as Collection).name,
  );
  const unsyncedHasButton = await cloudSyncFileDeletePage.hasFileDeleteButton(
    "My Environment",
  );

  const revealedBeforeHover = await cloudSyncFileDeletePage.isFileDeleteButtonRevealed(
    "My Environment",
  );
  await cloudSyncFileDeletePage.hoverFile("My Environment");
  const revealedOnHover = await cloudSyncFileDeletePage.isFileDeleteButtonRevealed(
    "My Environment",
  );
  await cloudSyncFileDeletePage.hoverFile((localCollection as Collection).name);
  const revealedAfterUnhover = await cloudSyncFileDeletePage.isFileDeleteButtonRevealed(
    "My Environment",
  );
  await cloudSyncFileDeletePage.focusFile("My Environment");
  const revealedOnFocus = await cloudSyncFileDeletePage.isFileDeleteButtonRevealed(
    "My Environment",
  );

  const logLines = await appFlow.captureMainProcessLog(async () => {
    await cloudSyncFileDeletePage.openFileDeleteDialog("My Environment");
    await cloudSyncFileDeletePage.dismissFileDeleteDialog(DialogDismissMethod.XButton);
    await cloudSyncFileDeletePage.openFileDeleteDialog("My Environment");
    await cloudSyncFileDeletePage.dismissFileDeleteDialog(DialogDismissMethod.Escape);
    await cloudSyncFileDeletePage.openFileDeleteDialog("My Environment");
    await cloudSyncFileDeletePage.dismissFileDeleteDialog(
      DialogDismissMethod.ClickOutside,
    );
  });
  const archivedLines = logLines.filter((line) =>
    /Archived remote project/.test(line),
  );
  const fileStillPresent = await cloudSyncFileDeletePage.isFileCardVisible(
    "My Environment",
  );

  expect(syncedHasButton).toBe(false);
  expect(localOnlyHasButton).toBe(false);
  expect(unsyncedHasButton).toBe(true);
  expect(revealedBeforeHover).toBe(false);
  expect(revealedOnHover).toBe(true);
  expect(revealedAfterUnhover).toBe(false);
  expect(revealedOnFocus).toBe(true);
  expect(archivedLines).toHaveLength(0);
  expect(fileStillPresent).toBe(true);
});
