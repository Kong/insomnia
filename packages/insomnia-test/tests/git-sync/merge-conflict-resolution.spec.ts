import { faker } from '@faker-js/faker';
import { expect } from "@playwright/test";

import { ProjectType } from '../../enums/project-types';
import { DEFAULT_TIMEOUT, GIT_CREDENTIAL, test } from '../../misc/git-fixtures';
import { Collection } from '../../models/collection';
import { Project } from '../../models/project';

for (const { version, chosenIndex } of [
  { version: 'Current', chosenIndex: 0 },
  { version: 'Incoming', chosenIndex: 1 },
] as const) {
  test(`Verify resolving a merge conflict by choosing the ${version} version keeps that side's collection name`, async ({
    user,
  }) => {
    const { gitSyncFlow, preferencesFlow, workspaceFlow } = user.flowManager;
    const { workspacePage } = user.pageManager;

    await preferencesFlow.addGitCredential(GIT_CREDENTIAL);
    const project = await workspaceFlow.cloneGitProject(
      new Project(faker.string.alphanumeric(10), ProjectType.Git),
      GIT_CREDENTIAL.name,
    );
    const collection = await workspaceFlow.createCollection(
      project,
      new Collection(faker.string.alphanumeric(10)),
      faker.string.alpha(10).toLowerCase(),
    );
    await gitSyncFlow.commit(faker.string.alphanumeric(10));

    const branchName = faker.string.alpha(10).toLowerCase();
    const branchCollectionName = faker.string.alphanumeric(10);
    await gitSyncFlow.createBranch(branchName);
    await workspaceFlow.renameCollection(collection, branchCollectionName);
    await gitSyncFlow.commit(faker.string.alphanumeric(10));

    const currentCollectionName = faker.string.alphanumeric(10);
    await gitSyncFlow.switchBranch('master');
    await workspaceFlow.renameCollection(collection, currentCollectionName);
    await gitSyncFlow.commit(faker.string.alphanumeric(10));

    await gitSyncFlow.mergeBranchResolvingConflicts(branchName, version);
    const names = [currentCollectionName, branchCollectionName];
    const chosenName = names[chosenIndex];
    const discardedName = names[1 - chosenIndex];

    await expect
      .poll(async () => workspacePage.findItemNode(new Collection(chosenName)), { timeout: DEFAULT_TIMEOUT })
      .toBeDefined();
    expect(await workspacePage.findItemNode(new Collection(discardedName))).toBeUndefined();
  });
}
