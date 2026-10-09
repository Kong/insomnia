import { faker } from '@faker-js/faker';

import { ProjectType } from '../../enums/project-types';
import { expect, GIT_CREDENTIAL, test } from '../../misc/git-fixtures';
import { Project } from '../../models/project';

test('Verify creating a branch with a duplicate or invalid name shows an error and keeps the current branch', async ({
  user,
}) => {
  const { gitSyncFlow, preferencesFlow, workspaceFlow } = user.flowManager;
  const { gitSyncPage } = user.pageManager;

  await preferencesFlow.addGitCredential(GIT_CREDENTIAL);
  await workspaceFlow.create(new Project(faker.string.alphanumeric(10), ProjectType.Git), GIT_CREDENTIAL.name);
  const branchName = faker.string.alpha(10).toLowerCase();
  await gitSyncFlow.createBranch(branchName);

  const duplicateError = await gitSyncFlow.createBranchExpectingError(branchName);
  const invalidName = `${faker.string.alpha(5).toLowerCase()} ${faker.string.alpha(5).toLowerCase()}`;
  const invalidError = await gitSyncFlow.createBranchExpectingError(invalidName);
  const branches = await gitSyncFlow.getBranches();
  const currentBranch = await gitSyncPage.getCurrentBranch();

  expect(duplicateError).toContain(`A branch named "${branchName}" already exists`);
  expect(invalidError).toContain(`"${invalidName}" would be an invalid git reference`);
  expect(branches.local.sort()).toEqual(['master', branchName].sort());
  expect(currentBranch).toBe(branchName);
});
