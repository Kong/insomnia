import { faker } from '@faker-js/faker';
import { expect } from "@playwright/test";

import { GitChangeList } from '../../../enums/git-change-list';
import { HttpMethod } from '../../../enums/http-method';
import { ProjectType } from '../../../enums/project-types';
import { HTTP_SERVER } from '../../../misc/fixtures';
import { DEFAULT_TIMEOUT, GIT_CREDENTIAL, test } from "../../../misc/git-fixtures";
import { Collection } from '../../../models/collection';
import { Folder } from '../../../models/folder';
import { HttpRequest } from '../../../models/http-request';
import { Project } from '../../../models/project';

test('Verify staging and discarding a folder does not touch the requests inside it, and discarding a new folder warns that its contents go too', async ({ user }) => {
  const { folderFlow, gitSyncFlow, httpRequestFlow, preferencesFlow, workspaceFlow } = user.flowManager;
  const { gitSyncPage, httpRequestPage } = user.pageManager;

  await preferencesFlow.addGitCredential(GIT_CREDENTIAL);
  const project = await workspaceFlow.cloneGitProject(new Project(faker.string.alphanumeric(10), ProjectType.Git), GIT_CREDENTIAL.name);
  const baseName = faker.string.alpha(10).toLowerCase();
  const collection = await workspaceFlow.createCollection(project, new Collection(faker.string.alphanumeric(10)), baseName);
  const fileName = `${baseName}.yaml`;
  const createRequest = (parent: Collection | Folder) =>
    httpRequestFlow.create(parent, new HttpRequest({ name: faker.string.alpha(10), url: `${HTTP_SERVER}/${faker.string.alphanumeric(10)}`, method: HttpMethod.Get }));
  const folder = await folderFlow.create(collection, new Folder(faker.string.alpha(10)));
  const request = await createRequest(folder);
  await gitSyncFlow.commit(faker.string.alphanumeric(10));
  const editedUrl = `${HTTP_SERVER}/${faker.string.alphanumeric(10)}`;
  await folderFlow.setScripts(folder, { preRequest: `console.log('${faker.string.alphanumeric(10)}');` });
  await httpRequestFlow.get(request);
  await httpRequestPage.setUrl(editedUrl);
  const newFolder = await folderFlow.create(collection, new Folder(faker.string.alpha(10)));
  const newNestedRequests = [await createRequest(newFolder), await createRequest(newFolder)];
  const emptyFolder = await folderFlow.create(collection, new Folder(faker.string.alpha(10)));
  await expect.poll(async () => gitSyncPage.hasUncommittedChanges(), { timeout: DEFAULT_TIMEOUT }).toBe(true);

  await gitSyncFlow.stageEntity(fileName, folder.name);
  const unstagedCardsAfterStage = await gitSyncPage.getEntityCardNames();
  await gitSyncFlow.openVisualDiff(GitChangeList.Staged, fileName);
  const stagedCards = await gitSyncPage.getEntityCardNames();
  await gitSyncFlow.unstageEntity(fileName, folder.name);
  await gitSyncFlow.discardEntity(fileName, folder.name);
  const unstagedCardsAfterDiscard = await gitSyncPage.getEntityCardNames();
  await gitSyncPage.startEntityDiscard(newFolder.name);
  const contentsConfirmLabel = await gitSyncPage.getEntityDiscardConfirmLabel(newFolder.name);
  await gitSyncPage.confirmEntityDiscard(newFolder.name);
  await gitSyncPage.startEntityDiscard(emptyFolder.name);
  const emptyConfirmLabel = await gitSyncPage.getEntityDiscardConfirmLabel(emptyFolder.name);
  await gitSyncPage.confirmEntityDiscard(emptyFolder.name);
  const unstagedCardsAtEnd = await gitSyncPage.getEntityCardNames();
  await gitSyncPage.closeCommitDialog();
  const requestAfterDiscard = await httpRequestFlow.get(request);

  const newFolderCards = [newFolder, ...newNestedRequests, emptyFolder].map(entity => entity.name);
  expect(unstagedCardsAfterStage.sort()).toEqual([request.name, ...newFolderCards].sort());
  expect(stagedCards).toEqual([folder.name]);
  expect(unstagedCardsAfterDiscard.sort()).toEqual([request.name, ...newFolderCards].sort());
  expect(contentsConfirmLabel).toBe('Confirm (discards its contents too)');
  expect(emptyConfirmLabel).toBe('Confirm');
  expect(unstagedCardsAtEnd).toEqual([request.name]);
  expect(requestAfterDiscard?.url).toBe(editedUrl);
});
