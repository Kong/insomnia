import { faker } from '@faker-js/faker';

import { GitChangeList } from '../../../enums/git-change-list';
import { ProjectType } from '../../../enums/project-types';
import { seedCloudSyncProject } from '../../../misc/fixtures';
import { DEFAULT_TIMEOUT, expect, GIT_CREDENTIAL, pushServerFile, test } from '../../../misc/git-fixtures';
import { Collection } from '../../../models/collection';
import { Project } from '../../../models/project';
import { buildCloudSyncDocs } from '../../cloud-sync/unknown-fields/helpers';
import { buildCollectionFileWithUnknownField } from './helpers';

test('Verify Cloud Sync and Git Sync unknown fields warnings stay independent in one session', async ({ user }) => {
  const { gitSyncFlow, httpRequestFlow, preferencesFlow, workspaceFlow, cloudSyncFlow } = user.flowManager;
  const { gitSyncPage, cloudSyncPage } = user.pageManager;

  const fileName = `${faker.string.alpha(10).toLowerCase()}.yaml`;
  const gitCollectionName = faker.string.alpha(10);
  const { content, requestName: gitRequestName } = buildCollectionFileWithUnknownField(gitCollectionName);
  await pushServerFile({ path: fileName, content });
  await preferencesFlow.addGitCredential(GIT_CREDENTIAL);
  await workspaceFlow.create(new Project(faker.string.alphanumeric(10), ProjectType.Git), GIT_CREDENTIAL.name);
  await expect
    .poll(async () => (await gitSyncFlow.getChanges()).unstaged, { timeout: DEFAULT_TIMEOUT })
    .toContain(fileName);
  await gitSyncPage.openCommitDialog();
  await gitSyncPage.openChangeDiff(GitChangeList.Unstaged, fileName);
  const gitBefore = {
    hasBanner: await gitSyncPage.isUnknownFieldsDiffWarningVisible(),
    highlighted: (await gitSyncPage.getUnknownFieldHighlightCount()) > 0,
  };
  await gitSyncPage.closeCommitDialog();

  const cloudCollectionName = faker.string.alpha(10);
  const { docs, requestName } = buildCloudSyncDocs(cloudCollectionName, { futureField: faker.string.alpha(10) });
  await seedCloudSyncProject(cloudCollectionName, docs);
  await user.page.reload();
  await cloudSyncFlow.fetch(cloudCollectionName);
  const cloudCollection = await workspaceFlow.getCollection({ name: cloudCollectionName });
  const request = await httpRequestFlow.get(requestName, cloudCollection);
  const renamed = faker.string.alphanumeric(10);
  await workspaceFlow.rename(request!, renamed);
  await cloudSyncPage.openCommitDialog();
  await cloudSyncPage.openChangeDiff(renamed);
  const cloudState = {
    hasBanner: await cloudSyncPage.isUnknownFieldsDiffWarningVisible(),
    highlighted: (await cloudSyncPage.getUnknownFieldHighlightCount()) > 0,
  };
  await cloudSyncPage.submitCommit(renamed, faker.lorem.sentence());
  const cloudConfirmationText = await cloudSyncPage.getUnknownFieldsConfirmationText();
  await cloudSyncPage.confirmUnknownFieldsCommit(renamed);

  await httpRequestFlow.get(gitRequestName, new Collection(gitCollectionName));
  await gitSyncPage.openCommitDialog();
  await gitSyncPage.openChangeDiff(GitChangeList.Unstaged, fileName);
  const gitAfter = {
    hasBanner: await gitSyncPage.isUnknownFieldsDiffWarningVisible(),
    highlighted: (await gitSyncPage.getUnknownFieldHighlightCount()) > 0,
    hasUndiscardableWarning: await gitSyncPage.isUndiscardableWarningVisible(),
  };

  expect(gitBefore).toEqual({ hasBanner: true, highlighted: true });
  expect(cloudState).toEqual({ hasBanner: true, highlighted: true });
  expect(cloudConfirmationText).toContain('may break or remove functionality for your collaborators');
  expect(gitAfter).toEqual({ hasBanner: true, highlighted: true, hasUndiscardableWarning: false });
});
