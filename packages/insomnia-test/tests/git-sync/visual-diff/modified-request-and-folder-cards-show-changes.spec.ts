import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

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

test('Verify a modified request card shows its old and new header values and each edited section, a folder card shows its script, and changed fields no tab covers appear in a Settings tab', async ({ user }) => {
  const { folderFlow, gitSyncFlow, httpRequestFlow, preferencesFlow, workspaceFlow } = user.flowManager;
  const { gitSyncPage, httpRequestPage } = user.pageManager;

  await preferencesFlow.addGitCredential(GIT_CREDENTIAL);
  const cloneParentDir = fs.mkdtempSync(path.join(os.tmpdir(), 'insomnia-visual-diff-'));
  const project = await workspaceFlow.create(new Project(faker.string.alphanumeric(10), ProjectType.Git), GIT_CREDENTIAL.name, { cloneParentDir });
  const cloneDir = path.join(cloneParentDir, fs.readdirSync(cloneParentDir)[0]);
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
  // Fields without a dedicated tab: a request send setting, and a confidential variable on the base environment
  const confidentialKey = faker.string.alpha(10);
  const original = fs.readFileSync(path.join(cloneDir, `${baseName}.yaml`), 'utf8');
  const withSettings = original
    .replace('followRedirects: global', 'followRedirects: "off"')
    .replace(/^( *)name: Base Environment$/m, `$1name: Base Environment\n$1data:\n$1  ${confidentialKey}: secret\n$1confidentialKeys:\n$1  - ${confidentialKey}`);
  expect(withSettings).not.toBe(original);
  fs.writeFileSync(path.join(cloneDir, `${baseName}.yaml`), withSettings);

  await gitSyncFlow.openVisualDiff(GitChangeList.Unstaged, `${baseName}.yaml`);
  const requestText = await gitSyncPage.getEntityCardText(request.name);
  const requestTabs = await gitSyncPage.getEntityCardTabs(request.name);
  const folderText = await gitSyncPage.getEntityCardText(folder.name);
  await gitSyncPage.selectEntityCardTab(request.name, 'Settings');
  const requestSettingsText = await gitSyncPage.getEntityCardText(request.name);
  const environmentTabs = await gitSyncPage.getEntityCardTabs('Base Environment');
  await gitSyncPage.selectEntityCardTab('Base Environment', 'Settings');
  const environmentSettingsText = await gitSyncPage.getEntityCardText('Base Environment');
  const folderTabs = await gitSyncPage.getEntityCardTabs(folder.name);

  expect(requestText).toContain(`POST\n${request.name}\n${newUrl}`);
  expect(requestText).toContain(`GET\n${oldUrl}`);
  expect(requestTabs).toEqual(['Params 1', 'Body', 'Headers 1', 'Scripts', 'Settings 1']);
  expect(folderTabs).toEqual(['Scripts']);
  expect(folderText).toContain("console.log('folder');");
  expect(requestSettingsText).toContain('followRedirects');
  expect(requestSettingsText).toContain('global');
  expect(requestSettingsText).toContain('off');
  expect(environmentTabs).toContain('Settings 1');
  expect(environmentSettingsText).toContain('Confidential Keys');
  expect(environmentSettingsText).toContain(confidentialKey);
});
