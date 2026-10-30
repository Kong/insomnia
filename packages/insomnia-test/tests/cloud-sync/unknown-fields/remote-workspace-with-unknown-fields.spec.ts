import { faker } from '@faker-js/faker';
import { expect } from "@playwright/test";

import { DEFAULT_TIMEOUT, seedCloudSyncProject, test } from "../../../misc/fixtures";
import { buildCloudSyncDocs } from './helpers';

test('Verify a Cloud Sync workspace whose remote version has unknown fields shows the warning, highlight and commit confirmation', async ({
  user,
}) => {
  const { workspaceFlow, cloudSyncFlow } = user.flowManager;
  const { cloudSyncPage } = user.pageManager;

  const collectionName = faker.string.alpha(10);
  const { docs } = buildCloudSyncDocs(collectionName, {}, { workspace: { futureField: faker.string.alpha(10) } });
  await seedCloudSyncProject(collectionName, docs);
  await user.page.reload();
  await cloudSyncFlow.fetch(collectionName);
  const collection = await workspaceFlow.getCollection({ name: collectionName });
  const renamed = faker.string.alphanumeric(10);
  await workspaceFlow.renameCollection(collection!, renamed);

  await cloudSyncPage.openCommitDialog();
  await cloudSyncPage.openChangeDiff(renamed);
  const iconTooltip = await cloudSyncPage.getUnknownFieldsIconTooltip(renamed);
  const hasBanner = await cloudSyncPage.isUnknownFieldsDiffWarningVisible();
  const highlightCount = await cloudSyncPage.getUnknownFieldHighlightCount();
  await cloudSyncPage.submitCommit(renamed, faker.lorem.sentence());
  const confirmationText = await cloudSyncPage.getUnknownFieldsConfirmationText();
  await cloudSyncPage.cancelUnknownFieldsConfirmation();
  const isStagedAfterCancel = await cloudSyncPage.isChangeStaged(renamed);
  await cloudSyncPage.clickCommit();
  const isConfirmationShownAgain = await cloudSyncPage.isUnknownFieldsConfirmationVisible();
  await cloudSyncPage.confirmUnknownFieldsCommit(renamed);

  expect(iconTooltip).toContain('fields not recognized by this version of Insomnia');
  expect(hasBanner).toBe(true);
  expect(highlightCount).toBeGreaterThan(0);
  expect(confirmationText).toContain('may break or remove functionality for your collaborators');
  expect(isStagedAfterCancel).toBe(true);
  expect(isConfirmationShownAgain).toBe(true);
  await expect.poll(() => cloudSyncPage.isCommitDisabled(), { timeout: DEFAULT_TIMEOUT }).toBe(true);
});
