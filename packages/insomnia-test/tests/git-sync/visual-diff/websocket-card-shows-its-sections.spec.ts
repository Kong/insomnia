import { faker } from '@faker-js/faker';

import { GitChangeList } from '../../../enums/git-change-list';
import { ProjectType } from '../../../enums/project-types';
import { WS_SERVER } from '../../../misc/fixtures';
import { DEFAULT_TIMEOUT, expect, GIT_CREDENTIAL, test } from '../../../misc/git-fixtures';
import { Collection } from '../../../models/collection';
import { Project } from '../../../models/project';
import { WebSocketRequest } from '../../../models/websocket-request';

test('Verify a new WebSocket request card shows its WS badge, URL and Params and Headers tabs', async ({ user }) => {
  const { gitSyncFlow, preferencesFlow, webSocketRequestFlow, workspaceFlow } = user.flowManager;
  const { gitSyncPage } = user.pageManager;

  await preferencesFlow.addGitCredential(GIT_CREDENTIAL);
  const project = await workspaceFlow.create(new Project(faker.string.alphanumeric(10), ProjectType.Git), GIT_CREDENTIAL.name);
  const baseName = faker.string.alpha(10).toLowerCase();
  const collection = await workspaceFlow.create(project, new Collection(faker.string.alphanumeric(10)), baseName);
  const request = await webSocketRequestFlow.create(
    collection,
    new WebSocketRequest({
      name: faker.string.alpha(10),
      url: `${WS_SERVER}/`,
      params: [{ name: 'room', value: faker.string.alphanumeric(6) }],
      headers: [{ name: 'X-Token', value: faker.string.alphanumeric(8) }],
    }),
  );
  await expect.poll(async () => gitSyncPage.hasUncommittedChanges(), { timeout: DEFAULT_TIMEOUT }).toBe(true);

  await gitSyncFlow.openVisualDiff(GitChangeList.Unstaged, `${baseName}.yaml`);
  const header = await gitSyncPage.getEntityCardHeader(request.name);
  const tabs = await gitSyncPage.getEntityCardTabs(request.name);
  await gitSyncPage.selectEntityCardTab(request.name, 'Headers');
  const headersText = await gitSyncPage.getEntityCardText(request.name);

  expect(header).toEqual({ badge: 'WS', name: request.name, url: request.url, onOneLine: true });
  expect(tabs).toEqual(['Params 1', 'Headers 1']);
  expect(headersText).toContain('X-Token');
});
