import { faker } from '@faker-js/faker';

import { ProjectType } from '../../enums/project-types';
import { buildCollectionFile, expect, GIT_CREDENTIAL, pushServerFile, test } from '../../misc/git-fixtures';
import { Collection } from '../../models/collection';
import { Project } from '../../models/project';

test('Verify a branch that exists only on the remote is listed after Fetch and can be checked out', async ({ user }) => {
  const { gitSyncFlow, preferencesFlow, workspaceFlow } = user.flowManager;
  const { gitSyncPage, workspacePage } = user.pageManager;

  await preferencesFlow.addGitCredential(GIT_CREDENTIAL);
  await workspaceFlow.create(new Project(faker.string.alphanumeric(10), ProjectType.Git), GIT_CREDENTIAL.name);
  const remoteBranch = faker.string.alpha(10).toLowerCase();
  const remoteCollection = new Collection(faker.string.alpha(10));
  const fileName = faker.string.alpha(10).toLowerCase();
  await pushServerFile({
    branch: remoteBranch,
    path: `${fileName}.yaml`,
    content: buildCollectionFile(remoteCollection.name),
  });

  await gitSyncFlow.fetch();
  const branchesBeforeCheckout = await gitSyncFlow.getBranches();
  await gitSyncFlow.checkoutRemoteBranch(remoteBranch);
  const currentBranch = await gitSyncPage.getCurrentBranch();
  const branchesAfterCheckout = await gitSyncFlow.getBranches();
  const node = await workspacePage.findItemNode(remoteCollection);

  expect(branchesBeforeCheckout.local).toEqual(['master']);
  expect(branchesBeforeCheckout.remote).toContain(remoteBranch);
  expect(currentBranch).toBe(remoteBranch);
  expect(branchesAfterCheckout.local).toContain(remoteBranch);
  expect(branchesAfterCheckout.remote).not.toContain(remoteBranch);
  expect(node).toBeDefined();
});
