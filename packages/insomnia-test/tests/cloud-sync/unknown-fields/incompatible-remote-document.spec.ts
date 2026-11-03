import { faker } from '@faker-js/faker';
import { seedCloudSyncProject } from "@package/misc/cloud-sync-mock";
import { DEFAULT_TIMEOUT, test } from "@package/misc/fixtures";
import { expect } from "@playwright/test";

import { buildCloudSyncDocs } from './helpers';

test('Verify a Cloud Sync document whose remote version is incompatible shows the error icon and banner and can still be committed', async ({ user }) => {
  const { workspaceFlow, httpRequestFlow, cloudSyncFlow } = user.flowManager;
  const { cloudSyncPage, cloudSyncCommitDialogPage } = user.pageManager;

  const collectionName = faker.string.alpha(10);
  const { docs, requestName } = buildCloudSyncDocs(collectionName, { settingEncodeUrl: faker.string.alpha(5) });
  await seedCloudSyncProject(collectionName, docs);
  await user.page.reload();
  await cloudSyncFlow.fetch(collectionName);
  const collection = await workspaceFlow.getCollection({ name: collectionName });
  const request = await httpRequestFlow.get(requestName);
  const renamed = faker.string.alphanumeric(10);
  await workspaceFlow.renameRequest(request!, renamed);

  await cloudSyncPage.openCommitDialog();
  await cloudSyncCommitDialogPage.openChangeDiff(renamed);
  const iconTooltip = await cloudSyncCommitDialogPage.getUnsupportedItemIconTooltip(renamed);
  const bannerText = await cloudSyncCommitDialogPage.getUnsupportedDocDiffErrorText();
  const hasUnknownFieldsBanner = await cloudSyncCommitDialogPage.isUnknownFieldsDiffWarningVisible();
  await cloudSyncCommitDialogPage.commit(renamed, faker.lorem.sentence());

  expect(iconTooltip).toContain('not supported by this version of Insomnia');
  expect(iconTooltip).toContain('converted to an older format');
  expect(bannerText).toContain('committing changes will break functionality for your collaborators');
  expect(hasUnknownFieldsBanner).toBe(false);
  await expect.poll(() => cloudSyncPage.isCommitDisabled(), { timeout: DEFAULT_TIMEOUT }).toBe(true);
});
