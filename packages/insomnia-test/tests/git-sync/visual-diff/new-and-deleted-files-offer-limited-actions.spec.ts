import { faker } from '@faker-js/faker';
import { GitChangeList } from '@package/enums/git-change-list';
import { HttpMethod } from '@package/enums/http-method';
import { ProjectType } from '@package/enums/project-types';
import { HTTP_SERVER } from '@package/misc/fixtures';
import { DEFAULT_TIMEOUT, GIT_CREDENTIAL, test } from "@package/misc/git-fixtures";
import { Collection } from '@package/models/collection';
import { HttpRequest } from '@package/models/http-request';
import { Project } from '@package/models/project';
import { expect } from "@playwright/test";

const BASE_ENVIRONMENT = 'Base Environment';
const DEFAULT_JAR = 'Default Jar';

test('Verify an added or deleted file has no Workspace actions, a deleted file offers no per-entity Discard, and the Base Environment and Default Jar of a new file cannot be discarded', async ({ user }) => {
  const { gitSyncFlow, httpRequestFlow, preferencesFlow, workspaceFlow } = user.flowManager;
  const { gitSyncPage, gitCommitDialogPage } = user.pageManager;

  await preferencesFlow.addGitCredential(GIT_CREDENTIAL);
  const project = await workspaceFlow.cloneGitProject(new Project(faker.string.alphanumeric(10), ProjectType.Git), GIT_CREDENTIAL.name);
  const createRequest = (parent: Collection) =>
    httpRequestFlow.create(parent, new HttpRequest({ name: faker.string.alpha(10), url: `${HTTP_SERVER}/${faker.string.alphanumeric(10)}`, method: HttpMethod.Get }));
  const deletedBaseName = faker.string.alpha(10).toLowerCase();
  const deletedCollection = await workspaceFlow.createCollection(project, new Collection(faker.string.alphanumeric(10)), deletedBaseName);
  const deletedRequest = await createRequest(deletedCollection);
  await gitSyncFlow.commit(faker.string.alphanumeric(10));
  const addedBaseName = faker.string.alpha(10).toLowerCase();
  const addedCollection = await workspaceFlow.createCollection(project, new Collection(faker.string.alphanumeric(10)), addedBaseName);
  const addedRequests = [await createRequest(addedCollection), await createRequest(addedCollection)];
  await workspaceFlow.delete(deletedCollection);
  await expect
    .poll(async () => (await gitSyncFlow.getChanges()).unstaged.length, { timeout: DEFAULT_TIMEOUT })
    .toBe(2);

  const deletedFileName = `${deletedBaseName}.yaml`;
  await gitSyncFlow.openVisualDiff(GitChangeList.Unstaged, deletedFileName);
  const deletedWorkspaceActions = await gitCommitDialogPage.getEntityCardActions(deletedCollection.name);
  const deletedRequestActions = await gitCommitDialogPage.getEntityCardActions(deletedRequest.name);
  const addedFileName = `${addedBaseName}.yaml`;
  await gitSyncFlow.openVisualDiff(GitChangeList.Unstaged, addedFileName);
  const addedWorkspaceActions = await gitCommitDialogPage.getEntityCardActions(addedCollection.name);
  const addedRequestActions = await gitCommitDialogPage.getEntityCardActions(addedRequests[0].name);
  for (const request of addedRequests) {
    await gitSyncFlow.discardEntity(addedFileName, request.name);
  }
  const remainingCards = await gitCommitDialogPage.getEntityCardNames();
  const environmentActions = await gitCommitDialogPage.getEntityCardActions(BASE_ENVIRONMENT);
  const jarActions = await gitCommitDialogPage.getEntityCardActions(DEFAULT_JAR);
  const unstaged = await gitCommitDialogPage.getUnstagedChanges();

  expect(deletedWorkspaceActions).toEqual([]);
  expect(deletedRequestActions).toEqual(['Stage']);
  expect(addedWorkspaceActions).toEqual([]);
  expect(addedRequestActions).toEqual(['Discard', 'Stage']);
  expect(remainingCards).toContain(BASE_ENVIRONMENT);
  expect(remainingCards).toContain(DEFAULT_JAR);
  for (const request of addedRequests) {
    expect(remainingCards).not.toContain(request.name);
  }
  expect(environmentActions).toEqual(['Stage']);
  expect(jarActions).toEqual(['Stage']);
  expect(unstaged).toContain(addedFileName);
});
