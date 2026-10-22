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
  const { unknownFieldFiles, unknownFieldsWarningText } = await workspaceFlow.cloneWithScanReport(
    new Project(faker.string.alphanumeric(10), ProjectType.Git),
    GIT_CREDENTIAL.name,
  );
  await expect
    .poll(async () => (await gitSyncFlow.getChanges()).unstaged, {
      timeout: DEFAULT_TIMEOUT,
    })
    .toContain(fileName);

  await gitSyncPage.openCommitDialog();
  await gitSyncPage.openChangeDiff(GitChangeList.Unstaged, fileName);
  const hasDiffWarning = await gitSyncPage.isUndiscardableWarningVisible();
  const hasUnknownFieldsBanner = await gitSyncPage.isUnknownFieldsDiffWarningVisible();
  const unknownFieldHighlightCount = await gitSyncPage.getUnknownFieldHighlightCount();
  await gitSyncPage.openDiscardConfirmation(fileName);

  expect(unknownFieldFiles).toEqual([]);
  expect(unknownFieldsWarningText).toBe('');
  expect(hasDiffWarning).toBe(true);
  expect(hasUnknownFieldsBanner).toBe(false);
  expect(unknownFieldHighlightCount).toBe(0);
  expect(await gitSyncPage.isUndiscardableWarningVisibleInDiscardDialog()).toBe(true);
  expect(await gitSyncPage.getDiscardConfirmationText()).toContain(UNDISCARDABLE_WARNING_TEXT);
});
