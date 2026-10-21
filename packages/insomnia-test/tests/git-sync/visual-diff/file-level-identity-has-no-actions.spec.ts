import { faker } from '@faker-js/faker';

import { GitChangeList } from '../../../enums/git-change-list';
import { HttpMethod } from '../../../enums/http-method';
import { ProjectType } from '../../../enums/project-types';
import { HTTP_SERVER } from '../../../misc/fixtures';
import { DEFAULT_TIMEOUT, expect, GIT_CREDENTIAL,test } from '../../../misc/git-fixtures';
import { Collection } from '../../../models/collection';
import { HttpRequest } from '../../../models/http-request';
import { Project } from '../../../models/project';

test('Verify the Workspace card of an added or deleted file has no actions and a deleted file offers no per-entity Discard', async ({ user }) => {
  const { gitSyncFlow, httpRequestFlow, preferencesFlow, workspaceFlow } = user.flowManager;
  const { gitSyncPage } = user.pageManager;

  await preferencesFlow.addGitCredential(GIT_CREDENTIAL);
  const project = await workspaceFlow.create(new Project(faker.string.alphanumeric(10), ProjectType.Git), GIT_CREDENTIAL.name);
  const baseName = faker.string.alpha(10).toLowerCase();
  const deletedCollection = await workspaceFlow.create(project, new Collection(faker.string.alphanumeric(10)), baseName);
  const deletedFileName = `${baseName}.yaml`;
  const deletedRequests: HttpRequest[] = [];
  for (let i = 0; i < 1; i++) {
    deletedRequests.push(
      await httpRequestFlow.create(
        deletedCollection,
        new HttpRequest({ name: faker.string.alpha(10), url: `${HTTP_SERVER}/${faker.string.alphanumeric(10)}`, method: HttpMethod.Get }),
      ),
    );
  }
  await gitSyncFlow.commit(faker.string.alphanumeric(10));
  const addedBaseName = faker.string.alpha(10).toLowerCase();
  const addedCollection = await workspaceFlow.create(project, new Collection(faker.string.alphanumeric(10)), addedBaseName);
  const createdAddedRequestRequests: HttpRequest[] = [];
  for (let i = 0; i < 1; i++) {
    createdAddedRequestRequests.push(
      await httpRequestFlow.create(
        addedCollection,
        new HttpRequest({ name: faker.string.alpha(10), url: `${HTTP_SERVER}/${faker.string.alphanumeric(10)}`, method: HttpMethod.Get }),
      ),
    );
  }
  const [addedRequest] = createdAddedRequestRequests;
  await workspaceFlow.delete(deletedCollection);
  await expect
    .poll(async () => (await gitSyncFlow.getChanges()).unstaged.length, { timeout: DEFAULT_TIMEOUT })
    .toBe(2);

  await gitSyncFlow.openVisualDiff(GitChangeList.Unstaged, `${addedBaseName}.yaml`);
  const addedWorkspaceActions = await gitSyncPage.getEntityCardActions(addedCollection.name);
  const addedRequestActions = await gitSyncPage.getEntityCardActions(addedRequest.name);
  await gitSyncFlow.openVisualDiff(GitChangeList.Unstaged, deletedFileName);
  const deletedWorkspaceActions = await gitSyncPage.getEntityCardActions(deletedCollection.name);
  const deletedRequestActions = await gitSyncPage.getEntityCardActions(deletedRequests[0].name);

  expect(addedWorkspaceActions).toEqual([]);
  expect(addedRequestActions).toEqual(['Discard', 'Stage']);
  expect(deletedWorkspaceActions).toEqual([]);
  expect(deletedRequestActions).toEqual(['Stage']);
});
