import { faker } from '@faker-js/faker';
import { expect } from "@playwright/test";

import { DEFAULT_TIMEOUT, test } from "@package/misc/fixtures";
import { EnvironmentKvPairDataType } from '@package/models/environment';
import { seedCloudSyncProject } from "@package/tests/cloud-sync/support/cloud-sync-mock";
import { buildCloudSyncDocs } from './helpers';

test('Verify a Cloud Sync environment whose remote version has unknown fields shows the warning, highlight and commit confirmation', async ({
  user,
}) => {
  const { workspaceFlow, cloudSyncFlow } = user.flowManager;
  const { cloudSyncPage, environmentPage, cloudSyncCommitDialogPage } = user.pageManager;

  const collectionName = faker.string.alpha(10);
  const { docs } = buildCloudSyncDocs(collectionName, {}, { environment: { futureField: faker.string.alpha(10) } });
  await seedCloudSyncProject(collectionName, docs);
  await user.page.reload();
  await cloudSyncFlow.fetch(collectionName);
  await workspaceFlow.getCollection({ name: collectionName });
  await environmentPage.openCollectionEnvironmentEditor();
  await environmentPage.addCollectionEnvironmentVariable({
    id: '',
    name: faker.string.alpha(8),
    value: faker.string.alpha(8),
    type: EnvironmentKvPairDataType.STRING,
  });

  const environmentRow = 'Base Environment';
  await cloudSyncPage.openCommitDialog();
  await cloudSyncCommitDialogPage.openChangeDiff(environmentRow);
  const iconTooltip = await cloudSyncCommitDialogPage.getUnknownFieldsIconTooltip(environmentRow);
  const hasBanner = await cloudSyncCommitDialogPage.isUnknownFieldsDiffWarningVisible();
  const highlightCount = await cloudSyncCommitDialogPage.getUnknownFieldHighlightCount();
  await cloudSyncCommitDialogPage.submitCommit(environmentRow, faker.lorem.sentence());
  const confirmationText = await cloudSyncCommitDialogPage.getUnknownFieldsConfirmationText();
  await cloudSyncCommitDialogPage.cancelUnknownFieldsConfirmation();
  const isStagedAfterCancel = await cloudSyncCommitDialogPage.isChangeStaged(environmentRow);
  await cloudSyncCommitDialogPage.clickCommit();
  const isConfirmationShownAgain = await cloudSyncCommitDialogPage.isUnknownFieldsConfirmationVisible();
  await cloudSyncCommitDialogPage.confirmUnknownFieldsCommit(environmentRow);

  expect(iconTooltip).toContain('fields not recognized by this version of Insomnia');
  expect(hasBanner).toBe(true);
  expect(highlightCount).toBeGreaterThan(0);
  expect(confirmationText).toContain('may break or remove functionality for your collaborators');
  expect(isStagedAfterCancel).toBe(true);
  expect(isConfirmationShownAgain).toBe(true);
  await expect.poll(() => cloudSyncPage.isCommitDisabled(), { timeout: DEFAULT_TIMEOUT }).toBe(true);
});
