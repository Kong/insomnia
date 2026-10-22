import { faker } from '@faker-js/faker';

import { GitChangeList } from '../../../enums/git-change-list';
import { ProjectType } from '../../../enums/project-types';
import { DEFAULT_TIMEOUT, expect, GIT_CREDENTIAL, pushServerFile, test } from '../../../misc/git-fixtures';
import { Project } from '../../../models/project';
import { buildReorderedCollectionFile } from './helpers';

test('Verify a file from an older schema that Insomnia only normalizes is flagged as undiscardable', async ({
  user,
}) => {
  const { gitSyncFlow, preferencesFlow, workspaceFlow } = user.flowManager;
  const { gitSyncPage } = user.pageManager;

  const fileName = `${faker.string.alpha(10).toLowerCase()}.yaml`;
  await pushServerFile({
    path: fileName,
    content: buildReorderedCollectionFile(faker.string.alpha(10), {
      oldSchema: true,
    }).content,
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

  expect(unknownFieldFiles).toEqual([]);
  expect(unknownFieldsWarningText).toBe('');
  expect(await gitSyncPage.isUndiscardableWarningVisible()).toBe(true);
  expect(await gitSyncPage.isUnknownFieldsDiffWarningVisible()).toBe(false);
  expect(await gitSyncPage.getUnknownFieldHighlightCount()).toBe(0);
});
