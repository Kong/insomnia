import { faker } from '@faker-js/faker';

import { DEFAULT_TIMEOUT, expect, seedCloudSyncProject, test } from '../../../misc/fixtures';
import { buildCloudSyncDocs } from './helpers';

test('Verify a Cloud Sync workspace with a scope this version does not know shows the error icon and banner without claiming it was converted to an older format', async ({ user }) => {
  test.fail();

  const { workspaceFlow, cloudSyncFlow } = user.flowManager;
  const { cloudSyncPage } = user.pageManager;

  const collectionName = faker.string.alpha(10);
  const { docs } = buildCloudSyncDocs(collectionName, {});
  const futureScope = faker.string.alpha(10);
  await seedCloudSyncProject(
    collectionName,
    docs.map((doc, index) => (index === 0 ? { ...doc, scope: futureScope } : doc)),
  );
  await user.page.reload();
  await cloudSyncFlow.fetch(collectionName);
  const collection = await workspaceFlow.getCollection({ name: collectionName });
  const renamed = faker.string.alphanumeric(10);
  await workspaceFlow.rename(collection!, renamed);

  await cloudSyncPage.openCommitDialog();
  await cloudSyncPage.openChangeDiff(renamed);
  const iconTooltip = await cloudSyncPage.getUnsupportedItemIconTooltip(renamed);
  const bannerText = await cloudSyncPage.getUnsupportedDocDiffErrorText();
  const hasUnknownFieldsBanner = await cloudSyncPage.isUnknownFieldsDiffWarningVisible();
  await cloudSyncPage.commit(renamed, faker.lorem.sentence());

  expect(iconTooltip).toContain('not supported by this version of Insomnia');
  expect(iconTooltip).not.toContain('converted to an older format');
  expect(bannerText).toContain('committing changes will break functionality for your collaborators');
  expect(hasUnknownFieldsBanner).toBe(false);
  await expect.poll(() => cloudSyncPage.isCommitDisabled(), { timeout: DEFAULT_TIMEOUT }).toBe(true);
});
