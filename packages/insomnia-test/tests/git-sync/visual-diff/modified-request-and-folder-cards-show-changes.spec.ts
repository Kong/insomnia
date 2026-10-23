import { faker } from '@faker-js/faker';

import { ContentType } from '../../../enums/content-type';
import { GitChangeList } from '../../../enums/git-change-list';
import { HttpMethod } from '../../../enums/http-method';
import { ProjectType } from '../../../enums/project-types';
import { HTTP_SERVER } from '../../../misc/fixtures';
import { DEFAULT_TIMEOUT, expect, GIT_CREDENTIAL, test } from '../../../misc/git-fixtures';
import { Collection } from '../../../models/collection';
import { Folder } from '../../../models/folder';
import { HttpRequest } from '../../../models/http-request';
import { Project } from '../../../models/project';

test('Verify a modified request card shows its old and new header values and each edited section, and a folder card shows its script', async ({ user }) => {
  const { folderFlow, gitSyncFlow, httpRequestFlow, preferencesFlow, workspaceFlow } = user.flowManager;
  const { gitSyncPage, httpRequestPage } = user.pageManager;

  await preferencesFlow.addGitCredential(GIT_CREDENTIAL);
  const project = await workspaceFlow.create(new Project(faker.string.alphanumeric(10), ProjectType.Git), GIT_CREDENTIAL.name);
  const baseName = faker.string.alpha(10).toLowerCase();
  const collection = await workspaceFlow.create(project, new Collection(faker.string.alphanumeric(10)), baseName);
  const oldUrl = `${HTTP_SERVER}/${faker.string.alphanumeric(10)}`;
  const newUrl = `${HTTP_SERVER}/${faker.string.alphanumeric(12)}`;
  const request = await httpRequestFlow.create(collection, new HttpRequest({ name: faker.string.alpha(10), url: oldUrl, method: HttpMethod.Get }));
  const folder = await folderFlow.create(collection, new Folder(faker.string.alpha(10)));
  await gitSyncFlow.commit(faker.string.alphanumeric(10));

  await httpRequestFlow.get(request);
  await httpRequestPage.setBody({ mimeType: ContentType.JSON, text: '{"edited":true}' });
  await httpRequestPage.setMethod(HttpMethod.Post);
  await httpRequestPage.setUrl(newUrl);
  await httpRequestPage.setParams([{ name: 'page', value: '2' }]);
  await httpRequestPage.scripts.setScripts({ preRequest: "console.log('edited');" });
  await folderFlow.setScripts(folder, { preRequest: "console.log('folder');" });
  await expect.poll(async () => gitSyncPage.hasUncommittedChanges(), { timeout: DEFAULT_TIMEOUT }).toBe(true);

  await gitSyncFlow.openVisualDiff(GitChangeList.Unstaged, `${baseName}.yaml`);
  const requestText = await gitSyncPage.getEntityCardText(request.name);
  const requestTabs = await gitSyncPage.getEntityCardTabs(request.name);
  const folderText = await gitSyncPage.getEntityCardText(folder.name);
  const folderTabs = await gitSyncPage.getEntityCardTabs(folder.name);

  expect(requestText).toContain(`POST\n${request.name}\n${newUrl}`);
  expect(requestText).toContain(`GET\n${oldUrl}`);
  expect(requestTabs).toEqual(['Params 1', 'Body', 'Headers 1', 'Scripts']);
  expect(folderTabs).toEqual(['Scripts']);
  expect(folderText).toContain("console.log('folder');");
});
