import { faker } from '@faker-js/faker';

import { GitChangeList } from '../../../enums/git-change-list';
import { HttpMethod } from '../../../enums/http-method';
import { ProjectType } from '../../../enums/project-types';
import { HTTP_SERVER } from '../../../misc/fixtures';
import { DEFAULT_TIMEOUT, expect, GIT_CREDENTIAL,test } from '../../../misc/git-fixtures';
import { Collection } from '../../../models/collection';
import { Folder } from '../../../models/folder';
import { HttpRequest } from '../../../models/http-request';
import { Project } from '../../../models/project';

test('Verify staging and discarding a folder does not touch the requests inside it', async ({ user }) => {
  const { folderFlow, gitSyncFlow, httpRequestFlow, preferencesFlow, workspaceFlow } = user.flowManager;
  const { gitSyncPage, httpRequestPage } = user.pageManager;

  await preferencesFlow.addGitCredential(GIT_CREDENTIAL);
  const project = await workspaceFlow.create(new Project(faker.string.alphanumeric(10), ProjectType.Git), GIT_CREDENTIAL.name);
  const baseName = faker.string.alpha(10).toLowerCase();
  const collection = await workspaceFlow.create(project, new Collection(faker.string.alphanumeric(10)), baseName);
  const fileName = `${baseName}.yaml`;
  const folder = await folderFlow.create(collection, new Folder(faker.string.alpha(10)));
  const createdRequestRequests: HttpRequest[] = [];
  for (let i = 0; i < 1; i++) {
    createdRequestRequests.push(
      await httpRequestFlow.create(
        folder,
        new HttpRequest({ name: faker.string.alpha(10), url: `${HTTP_SERVER}/${faker.string.alphanumeric(10)}`, method: HttpMethod.Get }),
      ),
    );
  }
  const [request] = createdRequestRequests;
  await gitSyncFlow.commit(faker.string.alphanumeric(10));
  const editedUrl = `${HTTP_SERVER}/${faker.string.alphanumeric(10)}`;
  await folderFlow.setScripts(folder, { preRequest: `console.log('${faker.string.alphanumeric(10)}');` });
  await httpRequestFlow.get(request);
  await httpRequestPage.setUrl(editedUrl);
  await expect.poll(async () => gitSyncPage.hasUncommittedChanges(), { timeout: DEFAULT_TIMEOUT }).toBe(true);

  await gitSyncFlow.stageEntity(fileName, folder.name);
  const unstagedCardsAfterStage = await gitSyncPage.getEntityCardNames();
  await gitSyncFlow.openVisualDiff(GitChangeList.Staged, fileName);
  const stagedCards = await gitSyncPage.getEntityCardNames();
  await gitSyncFlow.unstageEntity(fileName, folder.name);
  await gitSyncFlow.discardEntity(fileName, folder.name);
  const unstagedCardsAfterDiscard = await gitSyncPage.getEntityCardNames();
  await gitSyncPage.closeCommitDialog();
  const requestAfterDiscard = await httpRequestFlow.get(request);

  expect(unstagedCardsAfterStage).toEqual([request.name]);
  expect(stagedCards).toEqual([folder.name]);
  expect(unstagedCardsAfterDiscard).toEqual([request.name]);
  expect(requestAfterDiscard?.url).toBe(editedUrl);
});
