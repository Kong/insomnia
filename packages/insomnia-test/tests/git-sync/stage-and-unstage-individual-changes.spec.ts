import { faker } from '@faker-js/faker';

import { ProjectType } from '../../enums/project-types';
import { expect, GIT_CREDENTIAL, test } from '../../misc/git-fixtures';
import { Collection } from '../../models/collection';
import { Project } from '../../models/project';

test('Verify staging and unstaging individual changes only commits the staged file', async ({ user }) => {
  const { gitSyncFlow, preferencesFlow, workspaceFlow } = user.flowManager;

  await preferencesFlow.addGitCredential(GIT_CREDENTIAL);
  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Git),
    GIT_CREDENTIAL.name,
  );
  const stagedFile = faker.string.alpha(10).toLowerCase();
  const unstagedFile = faker.string.alpha(11).toLowerCase();
  await workspaceFlow.create(project, new Collection(faker.string.alphanumeric(10)), stagedFile);
  await workspaceFlow.create(project, new Collection(faker.string.alphanumeric(10)), unstagedFile);

  const initialChanges = await gitSyncFlow.getChanges();
  await gitSyncFlow.stageChanges([stagedFile, unstagedFile]);
  const allStagedChanges = await gitSyncFlow.getChanges();
  await gitSyncFlow.unstageChanges([unstagedFile]);
  const partiallyStagedChanges = await gitSyncFlow.getChanges();
  const message = faker.string.alphanumeric(10);
  const commit = await gitSyncFlow.commitStaged(message);
  const changesAfterCommit = await gitSyncFlow.getChanges();

  expect(initialChanges.staged).toEqual([]);
  expect(initialChanges.unstaged.sort()).toEqual([`${stagedFile}.yaml`, `${unstagedFile}.yaml`].sort());
  expect(allStagedChanges.unstaged).toEqual([]);
  expect(allStagedChanges.staged.sort()).toEqual([`${stagedFile}.yaml`, `${unstagedFile}.yaml`].sort());
  expect(partiallyStagedChanges.staged).toEqual([`${stagedFile}.yaml`]);
  expect(partiallyStagedChanges.unstaged).toEqual([`${unstagedFile}.yaml`]);
  expect(commit.message).toEqual(message);
  expect(changesAfterCommit.staged).toEqual([]);
  expect(changesAfterCommit.unstaged).toEqual([`${unstagedFile}.yaml`]);
});
