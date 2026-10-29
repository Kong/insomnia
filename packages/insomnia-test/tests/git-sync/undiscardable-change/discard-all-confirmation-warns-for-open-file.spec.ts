import { faker } from '@faker-js/faker';
import { expect } from "@playwright/test";

import { GitChangeList } from '../../../enums/git-change-list';
import { ProjectType } from '../../../enums/project-types';
import { DEFAULT_TIMEOUT, GIT_CREDENTIAL, pushServerFile, test } from "../../../misc/git-fixtures";
import { Project } from '../../../models/project';
import { buildReorderedCollectionFile, UNDISCARDABLE_WARNING_TEXT } from './helpers';

test('Verify the Discard all confirmation warns when the open file is an undiscardable change', async ({ user }) => {
  const { gitSyncFlow, preferencesFlow, workspaceFlow } = user.flowManager;
  const { gitSyncPage } = user.pageManager;

  const fileName = `${faker.string.alpha(10).toLowerCase()}.yaml`;
  await pushServerFile({ path: fileName, content: buildReorderedCollectionFile(faker.string.alpha(10)).content });
  await preferencesFlow.addGitCredential(GIT_CREDENTIAL);
  await workspaceFlow.cloneGitProject(new Project(faker.string.alphanumeric(10), ProjectType.Git), GIT_CREDENTIAL.name);
  await expect
    .poll(async () => (await gitSyncFlow.getChanges()).unstaged, {
      timeout: DEFAULT_TIMEOUT,
    })
    .toContain(fileName);
  await gitSyncPage.openCommitDialog();
  await gitSyncPage.openChangeDiff(GitChangeList.Unstaged, fileName);
  await gitSyncPage.openDiscardAllConfirmation();

  expect(await gitSyncPage.isUndiscardableWarningVisibleInDiscardDialog()).toBe(true);
  expect(await gitSyncPage.getDiscardConfirmationText()).toContain(UNDISCARDABLE_WARNING_TEXT);
});
