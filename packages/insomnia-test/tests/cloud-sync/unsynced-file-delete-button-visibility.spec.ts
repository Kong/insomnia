import { faker } from "@faker-js/faker";

import { expect, test } from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { DialogDismissMethod } from "../../pages/cloud-sync.page";

test("Verify the dashboard's unsynced-file delete button only appears on unsynced cards, is revealed on hover and keyboard focus, and cancelling its dialog leaves the file intact", async ({
  user,
}) => {
  const { workspaceFlow, cloudSyncFlow, appFlow } = user.flowManager;
  const { cloudSyncPage } = user.pageManager;

  const project = await workspaceFlow.getProject({ name: "Personal Workspace" });
  const localCollection = await workspaceFlow.create(
    project!,
    new Collection(faker.string.alphanumeric(10)),
  );

  await cloudSyncFlow.fetch("My Collection R1");
  await cloudSyncPage.backToAllProjects();
  await cloudSyncFlow.openProjectDashboard(project!);

  const syncedHasButton = await cloudSyncPage.hasFileDeleteButton(
    "My Collection R1",
  );
  const localOnlyHasButton = await cloudSyncPage.hasFileDeleteButton(
    (localCollection as Collection).name,
  );
  const unsyncedHasButton = await cloudSyncPage.hasFileDeleteButton(
    "My Environment",
  );

  const revealedBeforeHover = await cloudSyncPage.isFileDeleteButtonRevealed(
    "My Environment",
  );
  await cloudSyncPage.hoverFile("My Environment");
  const revealedOnHover = await cloudSyncPage.isFileDeleteButtonRevealed(
    "My Environment",
  );
  await cloudSyncPage.hoverFile((localCollection as Collection).name);
  const revealedAfterUnhover = await cloudSyncPage.isFileDeleteButtonRevealed(
    "My Environment",
  );
  await cloudSyncPage.focusFile("My Environment");
  const revealedOnFocus = await cloudSyncPage.isFileDeleteButtonRevealed(
    "My Environment",
  );

  const logLines = await appFlow.captureMainProcessLog(async () => {
    await cloudSyncPage.openFileDeleteDialog("My Environment");
    await cloudSyncPage.dismissFileDeleteDialog(DialogDismissMethod.XButton);
    await cloudSyncPage.openFileDeleteDialog("My Environment");
    await cloudSyncPage.dismissFileDeleteDialog(DialogDismissMethod.Escape);
    await cloudSyncPage.openFileDeleteDialog("My Environment");
    await cloudSyncPage.dismissFileDeleteDialog(
      DialogDismissMethod.ClickOutside,
    );
  });
  const archivedLines = logLines.filter((line) =>
    /Archived remote project/.test(line),
  );
  const fileStillPresent = await cloudSyncPage.isFileCardVisible(
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
