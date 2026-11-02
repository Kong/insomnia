import { faker } from '@faker-js/faker';
import { expect } from "@playwright/test";

import { GitChangeList } from '../../../enums/git-change-list';
import { ProjectType } from '../../../enums/project-types';
import { DEFAULT_TIMEOUT, GIT_CREDENTIAL, pushServerFile, test } from "../../../misc/git-fixtures";
import { Collection } from '../../../models/collection';
import { Project } from '../../../models/project';
import { buildReorderedCollectionFile } from './helpers';

test('Verify a staged hand-reordered file shows no undiscardable warning, including for a real edit made after staging', async ({
  user,
}) => {
  const { gitSyncFlow, httpRequestFlow, preferencesFlow, workspaceFlow } = user.flowManager;
  const { gitSyncPage, gitCommitDialogPage } = user.pageManager;

  const fileName = `${faker.string.alpha(10).toLowerCase()}.yaml`;
  const collectionName = faker.string.alpha(10);
  const { content, requestName } = buildReorderedCollectionFile(collectionName);
  await pushServerFile({ path: fileName, content });
  await preferencesFlow.addGitCredential(GIT_CREDENTIAL);
  await workspaceFlow.cloneGitProject(new Project(faker.string.alphanumeric(10), ProjectType.Git), GIT_CREDENTIAL.name);
  await expect
    .poll(async () => (await gitSyncFlow.getChanges()).unstaged, {
      timeout: DEFAULT_TIMEOUT,
    })
    .toContain(fileName);
  await gitSyncFlow.stageChanges([fileName]);

  await gitSyncPage.openCommitDialog();
  await gitCommitDialogPage.openChangeDiff(GitChangeList.Staged, fileName);
  const hasStagedWarning = await gitCommitDialogPage.isUndiscardableWarningVisible();
  await gitCommitDialogPage.closeCommitDialog();

  const request = await httpRequestFlow.get(requestName);
  await workspaceFlow.renameRequest(request!, faker.string.alphanumeric(10));
  await expect
    .poll(async () => (await gitSyncFlow.getChanges()).unstaged, {
      timeout: DEFAULT_TIMEOUT,
    })
    .toContain(fileName);
  await gitSyncPage.openCommitDialog();
  await gitCommitDialogPage.openChangeDiff(GitChangeList.Unstaged, fileName);
  const hasUnstagedWarning = await gitCommitDialogPage.isUndiscardableWarningVisible();
  await gitCommitDialogPage.openDiscardConfirmation(fileName);
  const hasDiscardDialogWarning = await gitCommitDialogPage.isUndiscardableWarningVisibleInDiscardDialog();
  await gitCommitDialogPage.confirmDiscard();

  expect(hasStagedWarning).toBe(false);
  expect(hasUnstagedWarning).toBe(false);
  expect(hasDiscardDialogWarning).toBe(false);
  await expect
    .poll(async () => (await gitCommitDialogPage.getUnstagedChanges()).includes(fileName), {
      timeout: DEFAULT_TIMEOUT,
    })
    .toBe(false);
  expect(await gitCommitDialogPage.getStagedChanges()).toContain(fileName);
});
