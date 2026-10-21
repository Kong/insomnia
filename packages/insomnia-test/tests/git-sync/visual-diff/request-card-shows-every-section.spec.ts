import { faker } from '@faker-js/faker';

import { ContentType } from '../../../enums/content-type';
import { GitChangeList } from '../../../enums/git-change-list';
import { HttpMethod } from '../../../enums/http-method';
import { ProjectType } from '../../../enums/project-types';
import { HTTP_SERVER, OAUTH2_CLIENT_ID, OAUTH2_CLIENT_SECRET, OAUTH2_SERVER } from '../../../misc/fixtures';
import { DEFAULT_TIMEOUT, expect, GIT_CREDENTIAL, test } from '../../../misc/git-fixtures';
import { Collection } from '../../../models/collection';
import { HttpRequest } from '../../../models/http-request';
import { Project } from '../../../models/project';

test('Verify a new request card shows each populated section as its own tab', async ({ user }) => {
  const { gitSyncFlow, httpRequestFlow, preferencesFlow, workspaceFlow } = user.flowManager;
  const { gitSyncPage } = user.pageManager;

  await preferencesFlow.addGitCredential(GIT_CREDENTIAL);
  const project = await workspaceFlow.create(new Project(faker.string.alphanumeric(10), ProjectType.Git), GIT_CREDENTIAL.name);
  const baseName = faker.string.alpha(10).toLowerCase();
  const collection = await workspaceFlow.create(project, new Collection(faker.string.alphanumeric(10)), baseName);
  await gitSyncFlow.commit(faker.string.alphanumeric(10));
  const request = await httpRequestFlow.create(
    collection,
    new HttpRequest({
      name: faker.string.alpha(10),
      url: `${HTTP_SERVER}/${faker.string.alphanumeric(10)}`,
      method: HttpMethod.Post,
      params: [{ name: 'page', value: '1' }],
      headers: [{ name: 'X-Trace', value: faker.string.alphanumeric(8) }],
      body: { mimeType: ContentType.JSON, text: '{"key":"value"}' },
      authentication: {
        type: 'oauth2',
        grantType: 'client_credentials',
        accessTokenUrl: `${OAUTH2_SERVER}/token`,
        clientId: OAUTH2_CLIENT_ID,
        clientSecret: OAUTH2_CLIENT_SECRET,
      },
      preRequestScript: "console.log('pre');",
      afterResponseScript: "console.log('after');",
    }),
  );
  await expect.poll(async () => gitSyncPage.hasUncommittedChanges(), { timeout: DEFAULT_TIMEOUT }).toBe(true);

  await gitSyncFlow.openVisualDiff(GitChangeList.Unstaged, `${baseName}.yaml`);
  const tabs = await gitSyncPage.getEntityCardTabs(request.name);
  const header = await gitSyncPage.getEntityCardHeader(request.name);

  const sectionTexts: Record<string, string> = {};
  for (const tab of ['Params', 'Body', 'Auth', 'Headers', 'Scripts']) {
    await gitSyncPage.selectEntityCardTab(request.name, tab);
    sectionTexts[tab] = await gitSyncPage.getEntityCardText(request.name);
  }

  expect(header).toMatchObject({ badge: 'POST', name: request.name, url: request.url, onOneLine: true });
  expect(tabs).toEqual(['Params 1', 'Body', 'Auth', 'Headers 2', 'Scripts']);
  expect(sectionTexts.Params).toContain('page');
  expect(sectionTexts.Body).toContain('application/json');
  expect(sectionTexts.Body).toContain('{"key":"value"}');
  expect(sectionTexts.Auth).toContain('client_credentials');
  expect(sectionTexts.Auth).toContain(`${OAUTH2_SERVER}/token`);
  expect(sectionTexts.Headers).toContain('X-Trace');
  expect(sectionTexts.Scripts).toContain("console.log('pre');");
  expect(sectionTexts.Scripts).toContain("console.log('after');");
});
