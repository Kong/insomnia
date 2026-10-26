import { faker } from '@faker-js/faker';

import { ContentType } from '../../../enums/content-type';
import { GitChangeList } from '../../../enums/git-change-list';
import { ProjectType } from '../../../enums/project-types';
import { DEFAULT_TIMEOUT, expect, GIT_CREDENTIAL, pushServerFile, test } from '../../../misc/git-fixtures';
import { Collection } from '../../../models/collection';
import { Project } from '../../../models/project';
import { buildReorderedCollectionFile } from './helpers';

test('Verify a body type edit on a reordered file is not flagged as only reformatting', async ({ user }) => {
  const { gitSyncFlow, httpRequestFlow, preferencesFlow, workspaceFlow } = user.flowManager;
  const { gitSyncPage, httpRequestPage } = user.pageManager;

  const fileName = `${faker.string.alpha(10).toLowerCase()}.yaml`;
  const collectionName = faker.string.alpha(10);
  const { content, requestName } = buildReorderedCollectionFile(collectionName);
  await pushServerFile({ path: fileName, content });
  await preferencesFlow.addGitCredential(GIT_CREDENTIAL);
  await workspaceFlow.create(new Project(faker.string.alphanumeric(10), ProjectType.Git), GIT_CREDENTIAL.name);
  await httpRequestFlow.get(requestName, new Collection(collectionName));
  await httpRequestPage.setBody({ mimeType: ContentType.JSON });
  await expect
    .poll(async () => (await gitSyncFlow.getChanges()).unstaged, {
      timeout: DEFAULT_TIMEOUT,
    })
    .toContain(fileName);
  await gitSyncPage.openCommitDialog();
  await gitSyncPage.openChangeDiff(GitChangeList.Unstaged, fileName);
  const hasDiffWarning = await gitSyncPage.isUndiscardableWarningVisible();
  await gitSyncPage.openDiscardConfirmation(fileName);
  const hasDiscardDialogWarning = await gitSyncPage.isUndiscardableWarningVisibleInDiscardDialog();

  expect(hasDiffWarning).toBe(false);
  expect(hasDiscardDialogWarning).toBe(false);
});
