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

test('Verify discarding a new folder with contents warns that its contents go too and removes them', async ({ user }) => {
  const { folderFlow, gitSyncFlow, httpRequestFlow, preferencesFlow, workspaceFlow } = user.flowManager;
  const { gitSyncPage } = user.pageManager;

  await preferencesFlow.addGitCredential(GIT_CREDENTIAL);
  const project = await workspaceFlow.create(new Project(faker.string.alphanumeric(10), ProjectType.Git), GIT_CREDENTIAL.name);
  const baseName = faker.string.alpha(10).toLowerCase();
  const collection = await workspaceFlow.create(project, new Collection(faker.string.alphanumeric(10)), baseName);
  const fileName = `${baseName}.yaml`;
  await gitSyncFlow.commit(faker.string.alphanumeric(10));
  const folderWithContents = await folderFlow.create(collection, new Folder(faker.string.alpha(10)));
  const nestedRequests: HttpRequest[] = [];
  for (let i = 0; i < 2; i++) {
    nestedRequests.push(
      await httpRequestFlow.create(
        folderWithContents,
        new HttpRequest({ name: faker.string.alpha(10), url: `${HTTP_SERVER}/${faker.string.alphanumeric(10)}`, method: HttpMethod.Get }),
      ),
    );
  }
  const emptyFolder = await folderFlow.create(collection, new Folder(faker.string.alpha(10)));
  await expect.poll(async () => gitSyncPage.hasUncommittedChanges(), { timeout: DEFAULT_TIMEOUT }).toBe(true);

  await gitSyncFlow.openVisualDiff(GitChangeList.Unstaged, fileName);
  await gitSyncPage.startEntityDiscard(folderWithContents.name);
  const contentsConfirmLabel = await gitSyncPage.getEntityDiscardConfirmLabel(folderWithContents.name);
  await gitSyncPage.confirmEntityDiscard(folderWithContents.name);
  await gitSyncPage.startEntityDiscard(emptyFolder.name);
  const emptyConfirmLabel = await gitSyncPage.getEntityDiscardConfirmLabel(emptyFolder.name);
  await gitSyncPage.confirmEntityDiscard(emptyFolder.name);
  await gitSyncPage.closeCommitDialog();

  expect(contentsConfirmLabel).toBe('Confirm (discards its contents too)');
  expect(emptyConfirmLabel).toBe('Confirm');
  await expect.poll(async () => gitSyncPage.hasUncommittedChanges(), { timeout: DEFAULT_TIMEOUT }).toBe(false);
});
