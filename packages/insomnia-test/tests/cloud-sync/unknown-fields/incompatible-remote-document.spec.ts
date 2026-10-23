import { faker } from '@faker-js/faker';

import { DEFAULT_TIMEOUT, expect, seedCloudSyncProject, test } from '../../../misc/fixtures';
import { buildCloudSyncDocs } from './helpers';

test('Verify a Cloud Sync document whose remote version is incompatible shows the error icon and banner and can still be committed', async ({ user }) => {
  const { workspaceFlow, httpRequestFlow, cloudSyncFlow } = user.flowManager;
  const { cloudSyncPage } = user.pageManager;

  const collectionName = faker.string.alpha(10);
  const { docs, requestName } = buildCloudSyncDocs(collectionName, { settingEncodeUrl: faker.string.alpha(5) });
  await seedCloudSyncProject(collectionName, docs);
  await user.page.reload();
  await cloudSyncFlow.fetch(collectionName);
  const collection = await workspaceFlow.getCollection({ name: collectionName });
  const request = await httpRequestFlow.get(requestName, collection);
  const renamed = faker.string.alphanumeric(10);
  await workspaceFlow.rename(request!, renamed);

  await cloudSyncPage.openCommitDialog();
  await cloudSyncPage.openChangeDiff(renamed);
  const iconTooltip = await cloudSyncPage.getUnsupportedItemIconTooltip(renamed);
  const bannerText = await cloudSyncPage.getUnsupportedDocDiffErrorText();
  const hasUnknownFieldsBanner = await cloudSyncPage.isUnknownFieldsDiffWarningVisible();
  await cloudSyncPage.commit(renamed, faker.lorem.sentence());

  expect(iconTooltip).toContain('not supported by this version of Insomnia');
  expect(iconTooltip).toContain('converted to an older format');
  expect(bannerText).toContain('committing changes will break functionality for your collaborators');
  expect(hasUnknownFieldsBanner).toBe(false);
  await expect.poll(() => cloudSyncPage.isCommitDisabled(), { timeout: DEFAULT_TIMEOUT }).toBe(true);
});
