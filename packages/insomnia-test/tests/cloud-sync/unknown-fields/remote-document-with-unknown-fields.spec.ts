import { faker } from '@faker-js/faker';
import { expect } from "@playwright/test";

import { DEFAULT_TIMEOUT, test } from "../../../misc/fixtures";
import { seedCloudSyncProject } from "../support/cloud-sync-mock";
import { buildCloudSyncDocs } from './helpers';

test('Verify a Cloud Sync document whose remote version has unknown fields shows the warning, highlight and commit confirmation', async ({
  user,
}) => {
  const { workspaceFlow, httpRequestFlow, cloudSyncFlow } = user.flowManager;
  const { cloudSyncPage, cloudSyncCommitDialogPage } = user.pageManager;

  const collectionName = faker.string.alpha(10);
  const { docs, requestName } = buildCloudSyncDocs(collectionName, { futureField: faker.string.alpha(10) });
  await seedCloudSyncProject(collectionName, docs);
  await user.page.reload();
  await cloudSyncFlow.fetch(collectionName);
  const collection = await workspaceFlow.getCollection({ name: collectionName });
  const request = await httpRequestFlow.get(requestName);
  const renamed = faker.string.alphanumeric(10);
  await workspaceFlow.renameRequest(request!, renamed);

  await cloudSyncPage.openCommitDialog();
  await cloudSyncCommitDialogPage.openChangeDiff(renamed);
  const iconTooltip = await cloudSyncCommitDialogPage.getUnknownFieldsIconTooltip(renamed);
  const hasBanner = await cloudSyncCommitDialogPage.isUnknownFieldsDiffWarningVisible();
  const highlightCount = await cloudSyncCommitDialogPage.getUnknownFieldHighlightCount();
  await cloudSyncCommitDialogPage.submitCommit(renamed, faker.lorem.sentence());
  const confirmationText = await cloudSyncCommitDialogPage.getUnknownFieldsConfirmationText();
  await cloudSyncCommitDialogPage.cancelUnknownFieldsConfirmation();
  const isStagedAfterCancel = await cloudSyncCommitDialogPage.isChangeStaged(renamed);
  await cloudSyncCommitDialogPage.clickCommit();
  const isConfirmationShownAgain = await cloudSyncCommitDialogPage.isUnknownFieldsConfirmationVisible();
  await cloudSyncCommitDialogPage.confirmUnknownFieldsCommit(renamed);

  expect(iconTooltip).toContain('fields not recognized by this version of Insomnia');
  expect(hasBanner).toBe(true);
  expect(highlightCount).toBeGreaterThan(0);
  expect(confirmationText).toContain('may break or remove functionality for your collaborators');
  expect(isStagedAfterCancel).toBe(true);
  expect(isConfirmationShownAgain).toBe(true);
  await expect.poll(() => cloudSyncPage.isCommitDisabled(), { timeout: DEFAULT_TIMEOUT }).toBe(true);
});
