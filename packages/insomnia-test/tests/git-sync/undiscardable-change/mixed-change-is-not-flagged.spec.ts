import { faker } from '@faker-js/faker';

import { GitChangeList } from '../../../enums/git-change-list';
import { ProjectType } from '../../../enums/project-types';
import { DEFAULT_TIMEOUT, expect, GIT_CREDENTIAL, pushServerFile, test } from '../../../misc/git-fixtures';
import { Collection } from '../../../models/collection';
import { Project } from '../../../models/project';
import { buildReorderedCollectionFile } from './helpers';

test('Verify a real edit mixed with a reorder is not flagged until the real edit is discarded', async ({ user }) => {
  const { gitSyncFlow, httpRequestFlow, preferencesFlow, workspaceFlow } = user.flowManager;
  const { gitSyncPage } = user.pageManager;

  const fileName = `${faker.string.alpha(10).toLowerCase()}.yaml`;
  const collectionName = faker.string.alpha(10);
  const { content, requestName } = buildReorderedCollectionFile(collectionName);
  await pushServerFile({ path: fileName, content });
  await preferencesFlow.addGitCredential(GIT_CREDENTIAL);
  await workspaceFlow.create(new Project(faker.string.alphanumeric(10), ProjectType.Git), GIT_CREDENTIAL.name);
  const collection = new Collection(collectionName);
  const request = await httpRequestFlow.get(requestName, collection);
  await workspaceFlow.rename(request!, faker.string.alphanumeric(10));
  await expect
    .poll(async () => (await gitSyncFlow.getChanges()).unstaged, {
      timeout: DEFAULT_TIMEOUT,
    })
    .toContain(fileName);
  await gitSyncPage.openCommitDialog();
  await gitSyncPage.openChangeDiff(GitChangeList.Unstaged, fileName);
  const warningWithMixedChange = await gitSyncPage.isUndiscardableWarningVisible();
  await gitSyncPage.closeCommitDialog();
  await gitSyncFlow.discardChangeAfterReview(fileName);

  expect(warningWithMixedChange).toBe(false);
  await expect
    .poll(
      async () => {
        await gitSyncPage.openCommitDialog();
        await gitSyncPage.openChangeDiff(GitChangeList.Unstaged, fileName);
        const hasWarning = await gitSyncPage.isUndiscardableWarningVisible();
        await gitSyncPage.closeCommitDialog();
        return hasWarning;
      },
      { timeout: DEFAULT_TIMEOUT },
    )
    .toBe(true);
});
