import { faker } from '@faker-js/faker';

import { GitChangeList } from '../../../enums/git-change-list';
import { ProjectType } from '../../../enums/project-types';
import { DEFAULT_TIMEOUT, expect, GIT_CREDENTIAL, pushServerFile, test } from '../../../misc/git-fixtures';
import { Project } from '../../../models/project';
import { buildReorderedCollectionFile, UNDISCARDABLE_WARNING_TEXT } from './helpers';

test('Verify a hand-reordered file warns that the change cannot be discarded in both the diff and the discard confirmation', async ({
  user,
}) => {
  const { gitSyncFlow, preferencesFlow, workspaceFlow } = user.flowManager;
  const { gitSyncPage } = user.pageManager;

  const fileName = `${faker.string.alpha(10).toLowerCase()}.yaml`;
  await pushServerFile({
    path: fileName,
    content: buildReorderedCollectionFile(faker.string.alpha(10)).content,
  });
  await preferencesFlow.addGitCredential(GIT_CREDENTIAL);
  await workspaceFlow.create(new Project(faker.string.alphanumeric(10), ProjectType.Git), GIT_CREDENTIAL.name);
  await expect
    .poll(async () => (await gitSyncFlow.getChanges()).unstaged, {
      timeout: DEFAULT_TIMEOUT,
    })
    .toContain(fileName);

  await gitSyncPage.openCommitDialog();
  await gitSyncPage.openChangeDiff(GitChangeList.Unstaged, fileName);
  const hasDiffWarning = await gitSyncPage.isUndiscardableWarningVisible();
  await gitSyncPage.openDiscardConfirmation(fileName);

  expect(hasDiffWarning).toBe(true);
  expect(await gitSyncPage.isUndiscardableWarningVisibleInDiscardDialog()).toBe(true);
  expect(await gitSyncPage.getDiscardConfirmationText()).toContain(UNDISCARDABLE_WARNING_TEXT);
});
