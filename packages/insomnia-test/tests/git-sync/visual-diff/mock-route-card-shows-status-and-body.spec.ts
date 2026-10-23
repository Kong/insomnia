import { faker } from '@faker-js/faker';

import { GitChangeList } from '../../../enums/git-change-list';
import { HttpMethod } from '../../../enums/http-method';
import { MockBodyType } from '../../../enums/mock-body-type';
import { ProjectType } from '../../../enums/project-types';
import { MOCK_BIN_SERVER } from '../../../misc/fixtures';
import { DEFAULT_TIMEOUT, expect, GIT_CREDENTIAL, test } from '../../../misc/git-fixtures';
import { MockServer } from '../../../models/mock-server';
import { Project } from '../../../models/project';

test('Verify a new mock route card shows its method, path, status and Body tab, and the Mock Server card shows its URL', async ({ user }) => {
  const { gitSyncFlow, mockServerFlow, preferencesFlow, workspaceFlow } = user.flowManager;
  const { gitSyncPage } = user.pageManager;

  await preferencesFlow.addGitCredential(GIT_CREDENTIAL);
  const project = await workspaceFlow.create(new Project(faker.string.alphanumeric(10), ProjectType.Git), GIT_CREDENTIAL.name);
  const server = await mockServerFlow.create(project, new MockServer(faker.string.alphanumeric(10), MOCK_BIN_SERVER));
  const route = await mockServerFlow.createRoute(server, {
    path: `/${faker.string.alpha(8)}`,
    method: HttpMethod.Post,
    statusCode: 201,
    statusText: 'Created',
    bodyType: MockBodyType.Json,
    body: '{"ok":true}',
  });
  await expect.poll(async () => gitSyncPage.hasUncommittedChanges(), { timeout: DEFAULT_TIMEOUT }).toBe(true);

  await gitSyncFlow.openVisualDiff(GitChangeList.Unstaged, `${server.name.toLowerCase()}.yaml`);
  const routeText = await gitSyncPage.getEntityCardText(route.path);
  const routeTabs = await gitSyncPage.getEntityCardTabs(route.path);
  const serverText = await gitSyncPage.getEntityCardText(MOCK_BIN_SERVER, 'Mock Server');

  expect(routeText).toContain(`POST\n${route.path}\n201 Created`);
  expect(routeTabs).toEqual(['Body']);
  expect(routeText).toContain('application/json');
  expect(routeText).toContain('{"ok":true}');
  expect(serverText).toContain(MOCK_BIN_SERVER);
});
