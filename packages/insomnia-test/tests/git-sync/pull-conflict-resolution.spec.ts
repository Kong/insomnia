import { faker } from '@faker-js/faker';
import { ProjectType } from '@package/enums/project-types';
import type { UserSession } from '@package/misc/fixtures';
import { buildCollectionFile, DEFAULT_TIMEOUT, GIT_CREDENTIAL, pushServerFile, test } from '@package/misc/git-fixtures';
import { Collection } from '@package/models/collection';
import { Project } from '@package/models/project';
import { expect } from "@playwright/test";

async function pullIntoConflict(user: UserSession, version: 'Current' | 'Incoming') {
  const { gitSyncFlow, preferencesFlow, workspaceFlow } = user.flowManager;
  const { gitBranchesDialogPage } = user.pageManager;

  await preferencesFlow.addGitCredential(GIT_CREDENTIAL);
  const project = await workspaceFlow.cloneGitProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Git),
    GIT_CREDENTIAL.name,
  );
  const fileName = faker.string.alpha(10).toLowerCase();
  const collection = await workspaceFlow.createCollection(project, new Collection(faker.string.alphanumeric(10)), fileName);
  await gitSyncFlow.commitAndPush(faker.string.alphanumeric(10));

  const localCollection = new Collection(faker.string.alpha(10));
  const remoteCollection = new Collection(faker.string.alpha(10));
  await workspaceFlow.renameCollection(collection, localCollection.name);
  await gitSyncFlow.commit(faker.string.alphanumeric(10));
  await pushServerFile({ path: `${fileName}.yaml`, content: buildCollectionFile(remoteCollection.name) });
  await gitSyncFlow.pull();
  await gitBranchesDialogPage.resolveMergeConflicts(version);
  return { localCollection, remoteCollection };
}

test("Verify resolving a pull conflict by choosing the Current version keeps that side's collection name", async ({
  user,
}) => {
  const { workspacePage } = user.pageManager;
  const { localCollection, remoteCollection } = await pullIntoConflict(user, 'Current');

  await expect
    .poll(async () => workspacePage.findItemNode(localCollection), { timeout: DEFAULT_TIMEOUT })
    .toBeDefined();
  expect(await workspacePage.findItemNode(remoteCollection)).toBeUndefined();
});

test("Verify resolving a pull conflict by choosing the Incoming version keeps that side's collection name", async ({
  user,
}) => {
  const { workspacePage } = user.pageManager;
  const { remoteCollection } = await pullIntoConflict(user, 'Incoming');

  await expect
    .poll(async () => workspacePage.findItemNode(remoteCollection), { timeout: DEFAULT_TIMEOUT })
    .toBeDefined();
});
