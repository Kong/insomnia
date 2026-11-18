import { faker } from '@faker-js/faker';
import { GitChangeList } from '@package/enums/git-change-list';
import { ProjectType } from '@package/enums/project-types';
import { seedCloudSyncProject } from '@package/misc/cloud-sync-mock';
import { DEFAULT_TIMEOUT, GIT_CREDENTIAL, pushServerFile, test } from "@package/misc/git-fixtures";
import { Collection } from '@package/models/collection';
import { Project } from '@package/models/project';
import { buildCloudSyncDocs } from '@package/tests/cloud-sync/unknown-fields/helpers';
import { expect } from "@playwright/test";

import { buildCollectionFileWithUnknownField } from './helpers';

test('Verify Cloud Sync and Git Sync unknown fields warnings stay independent in one session', async ({ user }) => {
  const { gitSyncFlow, httpRequestFlow, preferencesFlow, workspaceFlow, cloudSyncFlow } = user.flowManager;
  const { gitSyncPage, cloudSyncPage, cloudSyncCommitDialogPage, gitCommitDialogPage } = user.pageManager;

  const fileName = `${faker.string.alpha(10).toLowerCase()}.yaml`;
  const gitCollectionName = faker.string.alpha(10);
  const { content, requestName: gitRequestName } = buildCollectionFileWithUnknownField(gitCollectionName);
  await pushServerFile({ path: fileName, content });
  await preferencesFlow.addGitCredential(GIT_CREDENTIAL);
  await workspaceFlow.cloneGitProject(new Project(faker.string.alphanumeric(10), ProjectType.Git), GIT_CREDENTIAL.name);
  await expect
    .poll(async () => (await gitSyncFlow.getChanges()).unstaged, { timeout: DEFAULT_TIMEOUT })
    .toContain(fileName);
  await gitSyncPage.openCommitDialog();
  await gitCommitDialogPage.openChangeDiff(GitChangeList.Unstaged, fileName);
  const gitBefore = {
    hasBanner: await gitCommitDialogPage.isUnknownFieldsDiffWarningVisible(),
    highlighted: (await gitCommitDialogPage.getUnknownFieldHighlightCount()) > 0,
  };
  await gitCommitDialogPage.closeCommitDialog();

  const cloudCollectionName = faker.string.alpha(10);
  const { docs, requestName } = buildCloudSyncDocs(cloudCollectionName, { futureField: faker.string.alpha(10) });
  await seedCloudSyncProject(cloudCollectionName, docs);
  await user.page.reload();
  await cloudSyncFlow.fetch(cloudCollectionName);
  const cloudCollection = await workspaceFlow.getCollection({ name: cloudCollectionName });
  const request = await httpRequestFlow.get(requestName);
  const renamed = faker.string.alphanumeric(10);
  await workspaceFlow.renameRequest(request!, renamed);
  await cloudSyncPage.openCommitDialog();
  await cloudSyncCommitDialogPage.openChangeDiff(renamed);
  const cloudState = {
    hasBanner: await cloudSyncCommitDialogPage.isUnknownFieldsDiffWarningVisible(),
    highlighted: (await cloudSyncCommitDialogPage.getUnknownFieldHighlightCount()) > 0,
  };
  await cloudSyncCommitDialogPage.submitCommit(renamed, faker.lorem.sentence());
  const cloudConfirmationText = await cloudSyncCommitDialogPage.getUnknownFieldsConfirmationText();
  await cloudSyncCommitDialogPage.confirmUnknownFieldsCommit(renamed);

  await httpRequestFlow.get(gitRequestName);
  await gitSyncPage.openCommitDialog();
  await gitCommitDialogPage.openChangeDiff(GitChangeList.Unstaged, fileName);
  const gitAfter = {
    hasBanner: await gitCommitDialogPage.isUnknownFieldsDiffWarningVisible(),
    highlighted: (await gitCommitDialogPage.getUnknownFieldHighlightCount()) > 0,
    hasUndiscardableWarning: await gitCommitDialogPage.isUndiscardableWarningVisible(),
  };

  expect(gitBefore).toEqual({ hasBanner: true, highlighted: true });
  expect(cloudState).toEqual({ hasBanner: true, highlighted: true });
  expect(cloudConfirmationText).toContain('may break or remove functionality for your collaborators');
  expect(gitAfter).toEqual({ hasBanner: true, highlighted: true, hasUndiscardableWarning: false });
});
