import { faker } from '@faker-js/faker';
import { GitChangeList } from '@package/enums/git-change-list';
import { ProjectType } from '@package/enums/project-types';
import { DEFAULT_TIMEOUT, GIT_CREDENTIAL, pushServerFile, test } from "@package/misc/git-fixtures";
import { Collection } from '@package/models/collection';
import { Project } from '@package/models/project';
import { expect } from "@playwright/test";

import { buildReorderedCollectionFile } from './helpers';

test('Verify a real edit mixed with a reorder is not flagged until the real edit is discarded', async ({ user }) => {
  const { gitSyncFlow, httpRequestFlow, preferencesFlow, workspaceFlow } = user.flowManager;
  const { gitSyncPage, gitCommitDialogPage } = user.pageManager;

  const fileName = `${faker.string.alpha(10).toLowerCase()}.yaml`;
  const collectionName = faker.string.alpha(10);
  const { content, requestName } = buildReorderedCollectionFile(collectionName);
  await pushServerFile({ path: fileName, content });
  await preferencesFlow.addGitCredential(GIT_CREDENTIAL);
  await workspaceFlow.cloneGitProject(new Project(faker.string.alphanumeric(10), ProjectType.Git), GIT_CREDENTIAL.name);
  const collection = new Collection(collectionName);
  const request = await httpRequestFlow.get(requestName);
  await workspaceFlow.renameRequest(request!, faker.string.alphanumeric(10));
  await expect
    .poll(async () => (await gitSyncFlow.getChanges()).unstaged, {
      timeout: DEFAULT_TIMEOUT,
    })
    .toContain(fileName);
  await gitSyncPage.openCommitDialog();
  await gitCommitDialogPage.openChangeDiff(GitChangeList.Unstaged, fileName);
  const warningWithMixedChange = await gitCommitDialogPage.isUndiscardableWarningVisible();
  await gitCommitDialogPage.closeCommitDialog();
  await gitSyncFlow.discardChangeAfterReview(fileName);

  expect(warningWithMixedChange).toBe(false);
  await expect
    .poll(
      async () => {
        await gitSyncPage.openCommitDialog();
        await gitCommitDialogPage.openChangeDiff(GitChangeList.Unstaged, fileName);
        const hasWarning = await gitCommitDialogPage.isUndiscardableWarningVisible();
        await gitCommitDialogPage.closeCommitDialog();
        return hasWarning;
      },
      { timeout: DEFAULT_TIMEOUT },
    )
    .toBe(true);
});
