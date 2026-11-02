import { faker } from '@faker-js/faker';
import { expect } from "@playwright/test";

import { ProjectType } from '@package/enums/project-types';
import { GIT_CREDENTIAL, test } from '@package/misc/git-fixtures';
import { Collection } from '@package/models/collection';
import { Project } from '@package/models/project';

test('Verify committing with nothing staged prompts to stage all, and cancelling or omitting the message creates no commit', async ({
  user,
}) => {
  const { preferencesFlow, workspaceFlow } = user.flowManager;
  const { gitSyncPage, gitCommitDialogPage, gitHistoryDialogPage } = user.pageManager;

  await preferencesFlow.addGitCredential(GIT_CREDENTIAL);
  const project = await workspaceFlow.cloneGitProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Git),
    GIT_CREDENTIAL.name,
  );
  const fileName = faker.string.alpha(10).toLowerCase();
  await workspaceFlow.createCollection(project, new Collection(faker.string.alphanumeric(10)), fileName);

  await gitSyncPage.openHistory();
  const initialCommit = await gitHistoryDialogPage.getLatestCommit();
  await gitHistoryDialogPage.closeHistory();

  await gitSyncPage.openCommitDialog();
  await gitCommitDialogPage.commitStaged(faker.string.alphanumeric(10));
  const promptText = await gitCommitDialogPage.getStageAllPromptText();
  await gitCommitDialogPage.cancelStageAllPrompt();
  const stagedAfterCancel = await gitCommitDialogPage.getStagedChanges();
  await gitCommitDialogPage.stageChange(`${fileName}.yaml`);
  await gitCommitDialogPage.commitStaged();
  const dialogOpenWithoutMessage = await gitCommitDialogPage.isCommitDialogOpen();
  const stagedWithoutMessage = await gitCommitDialogPage.getStagedChanges();
  await gitCommitDialogPage.closeCommitDialog();

  await gitSyncPage.openHistory();
  const latestCommit = await gitHistoryDialogPage.getLatestCommit();
  await gitHistoryDialogPage.closeHistory();

  expect(promptText).toContain('There are no staged changes to commit');
  expect(stagedAfterCancel).toEqual([]);
  expect(dialogOpenWithoutMessage).toBe(true);
  expect(stagedWithoutMessage).toEqual([`${fileName}.yaml`]);
  expect(latestCommit?.id).toBe(initialCommit?.id);
});

test('Verify confirming the stage-all prompt stages every change and commits it', async ({ user }) => {
  const { preferencesFlow, workspaceFlow } = user.flowManager;
  const { gitSyncPage, gitCommitDialogPage, gitHistoryDialogPage } = user.pageManager;

  await preferencesFlow.addGitCredential(GIT_CREDENTIAL);
  const project = await workspaceFlow.cloneGitProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Git),
    GIT_CREDENTIAL.name,
  );
  await workspaceFlow.createCollection(
    project,
    new Collection(faker.string.alphanumeric(10)),
    faker.string.alpha(10).toLowerCase(),
  );
  await workspaceFlow.createCollection(
    project,
    new Collection(faker.string.alphanumeric(10)),
    faker.string.alpha(11).toLowerCase(),
  );

  const message = faker.string.alphanumeric(10);
  await gitSyncPage.openCommitDialog();
  await gitCommitDialogPage.commitStaged(message);
  await gitCommitDialogPage.confirmStageAllPrompt();
  await gitSyncPage.openHistory();
  const latestCommit = await gitHistoryDialogPage.getLatestCommit();
  await gitHistoryDialogPage.closeHistory();

  expect(latestCommit?.message).toBe(message);
});
