import { faker } from '@faker-js/faker';
import { expect } from "@playwright/test";

import { DEFAULT_TIMEOUT, seedCloudSyncProject, test } from "../../../misc/fixtures";
import { EnvironmentKvPairDataType } from '../../../models/environment';
import { buildCloudSyncDocs } from './helpers';

test('Verify a Cloud Sync environment whose remote version has unknown fields shows the warning, highlight and commit confirmation', async ({
  user,
}) => {
  const { workspaceFlow, cloudSyncFlow } = user.flowManager;
  const { cloudSyncPage, environmentPage } = user.pageManager;

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
  await cloudSyncPage.openChangeDiff(environmentRow);
  const iconTooltip = await cloudSyncPage.getUnknownFieldsIconTooltip(environmentRow);
  const hasBanner = await cloudSyncPage.isUnknownFieldsDiffWarningVisible();
  const highlightCount = await cloudSyncPage.getUnknownFieldHighlightCount();
  await cloudSyncPage.submitCommit(environmentRow, faker.lorem.sentence());
  const confirmationText = await cloudSyncPage.getUnknownFieldsConfirmationText();
  await cloudSyncPage.cancelUnknownFieldsConfirmation();
  const isStagedAfterCancel = await cloudSyncPage.isChangeStaged(environmentRow);
  await cloudSyncPage.clickCommit();
  const isConfirmationShownAgain = await cloudSyncPage.isUnknownFieldsConfirmationVisible();
  await cloudSyncPage.confirmUnknownFieldsCommit(environmentRow);

  expect(iconTooltip).toContain('fields not recognized by this version of Insomnia');
  expect(hasBanner).toBe(true);
  expect(highlightCount).toBeGreaterThan(0);
  expect(confirmationText).toContain('may break or remove functionality for your collaborators');
  expect(isStagedAfterCancel).toBe(true);
  expect(isConfirmationShownAgain).toBe(true);
  await expect.poll(() => cloudSyncPage.isCommitDisabled(), { timeout: DEFAULT_TIMEOUT }).toBe(true);
});
