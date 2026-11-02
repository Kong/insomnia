import { faker } from '@faker-js/faker';
import { expect } from "@playwright/test";

import { ProjectType } from '@package/enums/project-types';
import { getServerBranches, GIT_CREDENTIAL, test } from '@package/misc/git-fixtures';
import { Project } from '@package/models/project';

test('Verify creating a new branch in a Git Sync project switches to it', async ({ user }) => {
  const { gitSyncFlow, preferencesFlow, workspaceFlow } = user.flowManager;
  const { gitSyncPage } = user.pageManager;

  await preferencesFlow.addGitCredential(GIT_CREDENTIAL);
  await workspaceFlow.cloneGitProject(new Project(faker.string.alphanumeric(10), ProjectType.Git), GIT_CREDENTIAL.name);
  const branchName = faker.string.alphanumeric(10);
  await gitSyncFlow.createBranch(branchName);

  const branch = await gitSyncPage.getCurrentBranch();
  const serverBranches = await getServerBranches();

  expect(branch).toBe(branchName);
  expect(serverBranches).not.toContain(branchName);
});
