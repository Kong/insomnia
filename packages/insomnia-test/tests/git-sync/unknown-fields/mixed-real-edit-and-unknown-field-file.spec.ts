import { faker } from '@faker-js/faker';
import { expect } from "@playwright/test";

import { GitChangeList } from '../../../enums/git-change-list';
import { ProjectType } from '../../../enums/project-types';
import { DEFAULT_TIMEOUT, GIT_CREDENTIAL, pushServerFile, test } from "../../../misc/git-fixtures";
import { Collection } from '../../../models/collection';
import { Project } from '../../../models/project';
import { UNDISCARDABLE_WARNING_TEXT } from '../undiscardable-change/helpers';
import { buildCollectionFileWithUnknownField } from './helpers';

test('Verify a real edit mixed with an unknown field shows only the unknown fields UI, and discarding shows no undiscardable warning and brings the unknown fields warning back', async ({
  user,
}) => {
  const { gitSyncFlow, httpRequestFlow, preferencesFlow, workspaceFlow } = user.flowManager;
  const { gitSyncPage } = user.pageManager;

  const fileName = `${faker.string.alpha(10).toLowerCase()}.yaml`;
  const collectionName = faker.string.alpha(10);
  const { content, requestName } = buildCollectionFileWithUnknownField(collectionName);
  await pushServerFile({ path: fileName, content });
  await preferencesFlow.addGitCredential(GIT_CREDENTIAL);
  await workspaceFlow.cloneGitProject(new Project(faker.string.alphanumeric(10), ProjectType.Git), GIT_CREDENTIAL.name);
  const request = await httpRequestFlow.get(requestName, new Collection(collectionName));
  await workspaceFlow.renameRequest(request!, faker.string.alphanumeric(10));
  await expect
    .poll(async () => (await gitSyncFlow.getChanges()).unstaged, { timeout: DEFAULT_TIMEOUT })
    .toContain(fileName);

  await gitSyncPage.openCommitDialog();
  await gitSyncPage.openChangeDiff(GitChangeList.Unstaged, fileName);
  const mixedState = {
    hasBanner: await gitSyncPage.isUnknownFieldsDiffWarningVisible(),
    highlighted: (await gitSyncPage.getUnknownFieldHighlightCount()) > 0,
    hasUndiscardableWarning: await gitSyncPage.isUndiscardableWarningVisible(),
  };
  await gitSyncPage.openDiscardConfirmation(fileName);
  const discardDialogText = await gitSyncPage.getDiscardConfirmationText();
  await gitSyncPage.confirmDiscard();
  await gitSyncPage.closeCommitDialog();

  expect(mixedState).toEqual({ hasBanner: true, highlighted: true, hasUndiscardableWarning: false });
  expect(discardDialogText).not.toContain(UNDISCARDABLE_WARNING_TEXT);
  await expect
    .poll(async () => (await gitSyncFlow.getChanges()).unstaged, { timeout: DEFAULT_TIMEOUT })
    .toEqual([fileName]);
  await expect
    .poll(
      async () => {
        await gitSyncPage.openCommitDialog();
        await gitSyncPage.openChangeDiff(GitChangeList.Unstaged, fileName);
        const state = {
          hasBanner: await gitSyncPage.isUnknownFieldsDiffWarningVisible(),
          highlighted: (await gitSyncPage.getUnknownFieldHighlightCount()) > 0,
          hasUndiscardableWarning: await gitSyncPage.isUndiscardableWarningVisible(),
        };
        await gitSyncPage.closeCommitDialog();
        return state;
      },
      { timeout: DEFAULT_TIMEOUT },
    )
    .toEqual({ hasBanner: true, highlighted: true, hasUndiscardableWarning: false });
});
