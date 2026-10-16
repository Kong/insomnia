import { faker } from '@faker-js/faker';

import { ProjectType } from '../../enums/project-types';
import { expect, GIT_CREDENTIAL, test } from '../../misc/git-fixtures';
import { Collection } from '../../models/collection';
import { Project } from '../../models/project';

test('Verify committing with nothing staged prompts to stage all, and cancelling or omitting the message creates no commit', async ({
  user,
}) => {
  const { preferencesFlow, workspaceFlow } = user.flowManager;
  const { gitSyncPage } = user.pageManager;

  await preferencesFlow.addGitCredential(GIT_CREDENTIAL);
  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Git),
    GIT_CREDENTIAL.name,
  );
  const fileName = faker.string.alpha(10).toLowerCase();
  await workspaceFlow.create(project, new Collection(faker.string.alphanumeric(10)), fileName);

  await gitSyncPage.openHistory();
  const initialCommit = await gitSyncPage.getLatestCommit();
  await gitSyncPage.closeHistory();

  await gitSyncPage.openCommitDialog();
  await gitSyncPage.commitStaged(faker.string.alphanumeric(10));
  const promptText = await gitSyncPage.getStageAllPromptText();
  await gitSyncPage.cancelStageAllPrompt();
  const stagedAfterCancel = await gitSyncPage.getStagedChanges();
  await gitSyncPage.stageChange(`${fileName}.yaml`);
  await gitSyncPage.commitStaged();
  const dialogOpenWithoutMessage = await gitSyncPage.isCommitDialogOpen();
  const stagedWithoutMessage = await gitSyncPage.getStagedChanges();
  await gitSyncPage.closeCommitDialog();

  await gitSyncPage.openHistory();
  const latestCommit = await gitSyncPage.getLatestCommit();
  await gitSyncPage.closeHistory();

  expect(promptText).toContain('There are no staged changes to commit');
  expect(stagedAfterCancel).toEqual([]);
  expect(dialogOpenWithoutMessage).toBe(true);
  expect(stagedWithoutMessage).toEqual([`${fileName}.yaml`]);
  expect(latestCommit?.id).toBe(initialCommit?.id);
});

test('Verify confirming the stage-all prompt stages every change and commits it', async ({ user }) => {
  const { preferencesFlow, workspaceFlow } = user.flowManager;
  const { gitSyncPage } = user.pageManager;

  await preferencesFlow.addGitCredential(GIT_CREDENTIAL);
  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Git),
    GIT_CREDENTIAL.name,
  );
  await workspaceFlow.create(
    project,
    new Collection(faker.string.alphanumeric(10)),
    faker.string.alpha(10).toLowerCase(),
  );
  await workspaceFlow.create(
    project,
    new Collection(faker.string.alphanumeric(10)),
    faker.string.alpha(11).toLowerCase(),
  );

  const message = faker.string.alphanumeric(10);
  await gitSyncPage.openCommitDialog();
  await gitSyncPage.commitStaged(message);
  await gitSyncPage.confirmStageAllPrompt();
  await gitSyncPage.openHistory();
  const latestCommit = await gitSyncPage.getLatestCommit();
  await gitSyncPage.closeHistory();

  expect(latestCommit?.message).toBe(message);
});
