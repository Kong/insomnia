import { faker } from '@faker-js/faker';
import { expect } from "@playwright/test";

import { ContentType } from '@package/enums/content-type';
import { GitChangeList } from '@package/enums/git-change-list';
import { ProjectType } from '@package/enums/project-types';
import { DEFAULT_TIMEOUT, GIT_CREDENTIAL, pushServerFile, test } from "@package/misc/git-fixtures";
import { Collection } from '@package/models/collection';
import { Project } from '@package/models/project';
import { buildReorderedCollectionFile } from './helpers';

test('Verify a body type edit on a reordered file is not flagged as only reformatting', async ({ user }) => {
  const { gitSyncFlow, httpRequestFlow, preferencesFlow, workspaceFlow } = user.flowManager;
  const { gitSyncPage, httpRequestPage, gitCommitDialogPage } = user.pageManager;

  const fileName = `${faker.string.alpha(10).toLowerCase()}.yaml`;
  const collectionName = faker.string.alpha(10);
  const { content, requestName } = buildReorderedCollectionFile(collectionName);
  await pushServerFile({ path: fileName, content });
  await preferencesFlow.addGitCredential(GIT_CREDENTIAL);
  await workspaceFlow.cloneGitProject(new Project(faker.string.alphanumeric(10), ProjectType.Git), GIT_CREDENTIAL.name);
  await httpRequestFlow.get(requestName);
  await httpRequestPage.setBody({ mimeType: ContentType.JSON }, (filePath) => user.flowManager.context.stubFileChooser(filePath));
  await expect
    .poll(async () => (await gitSyncFlow.getChanges()).unstaged, {
      timeout: DEFAULT_TIMEOUT,
    })
    .toContain(fileName);
  await gitSyncPage.openCommitDialog();
  await gitCommitDialogPage.openChangeDiff(GitChangeList.Unstaged, fileName);
  const hasDiffWarning = await gitCommitDialogPage.isUndiscardableWarningVisible();
  await gitCommitDialogPage.openDiscardConfirmation(fileName);
  const hasDiscardDialogWarning = await gitCommitDialogPage.isUndiscardableWarningVisibleInDiscardDialog();

  expect(hasDiffWarning).toBe(false);
  expect(hasDiscardDialogWarning).toBe(false);
});
