import { faker } from '@faker-js/faker';
import { ProjectType } from '@package/enums/project-types';
import { getServerBranches, GIT_CREDENTIAL, test } from '@package/misc/git-fixtures';
import { Collection } from '@package/models/collection';
import { Project } from '@package/models/project';
import { expect } from "@playwright/test";

test(
  'Verify merging a branch carries its committed changes into the current branch',
  async ({ user }) => {
    const { gitSyncFlow, preferencesFlow, workspaceFlow } = user.flowManager;
    const { workspacePage } = user.pageManager;

    await preferencesFlow.addGitCredential(GIT_CREDENTIAL);
    const project = await workspaceFlow.cloneGitProject(
      new Project(faker.string.alphanumeric(10), ProjectType.Git),
      GIT_CREDENTIAL.name,
    );

    const branchName = faker.string.alphanumeric(10);
    await gitSyncFlow.createBranch(branchName);
    const collection = await workspaceFlow.createCollection(
      project,
      new Collection(faker.string.alphanumeric(10)),
      faker.string.alphanumeric(10),
    );
    await gitSyncFlow.commit(faker.string.alphanumeric(10));
    await gitSyncFlow.switchBranch('master');
    await gitSyncFlow.mergeBranch(branchName);

    const node = await workspacePage.findItemNode(collection);
    const serverBranches = await getServerBranches();

    expect(node).toBeDefined();
    expect(serverBranches).toEqual(['master']);
  },
);
