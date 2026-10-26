import { faker } from '@faker-js/faker';

import { ContentType } from '../../../enums/content-type';
import { GitChangeList } from '../../../enums/git-change-list';
import { GitDiffView } from '../../../enums/git-diff-view';
import { HttpMethod } from '../../../enums/http-method';
import { MockBodyType } from '../../../enums/mock-body-type';
import { ProjectType } from '../../../enums/project-types';
import { MCP_SERVER } from '../../../misc/constants';
import { HTTP_SERVER, MOCK_BIN_SERVER, OAUTH2_CLIENT_ID, OAUTH2_CLIENT_SECRET, OAUTH2_SERVER, WS_SERVER } from '../../../misc/fixtures';
import { DEFAULT_TIMEOUT, expect, GIT_CREDENTIAL, test } from '../../../misc/git-fixtures';
import { Collection } from '../../../models/collection';
import { HttpRequest } from '../../../models/http-request';
import { McpClient } from '../../../models/mcp-client';
import { MockServer } from '../../../models/mock-server';
import { Project } from '../../../models/project';
import { SocketIORequest } from '../../../models/socket-io-request';
import { WebSocketRequest } from '../../../models/websocket-request';

test('Verify the diff pane defaults to Text and every new entity card shows its badge, URL on one line and each populated section as its own tab', async ({ user }) => {
  const { gitSyncFlow, httpRequestFlow, mcpClientFlow, mockServerFlow, preferencesFlow, socketIoRequestFlow, webSocketRequestFlow, workspaceFlow } = user.flowManager;
  const { gitSyncPage } = user.pageManager;

  await preferencesFlow.addGitCredential(GIT_CREDENTIAL);
  const project = await workspaceFlow.create(new Project(faker.string.alphanumeric(10), ProjectType.Git), GIT_CREDENTIAL.name);
  const httpBaseName = faker.string.alpha(10).toLowerCase();
  const httpCollection = await workspaceFlow.create(project, new Collection(faker.string.alphanumeric(10)), httpBaseName);
  await gitSyncFlow.commit(faker.string.alphanumeric(10));
  const httpRequest = await httpRequestFlow.create(
    httpCollection,
    new HttpRequest({
      name: faker.string.alpha(10),
      url: `${HTTP_SERVER}/${faker.string.alphanumeric(10)}/${faker.string.alphanumeric(120)}`,
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
  const realtimeBaseName = faker.string.alpha(10).toLowerCase();
  const realtimeCollection = await workspaceFlow.create(project, new Collection(faker.string.alphanumeric(10)), realtimeBaseName);
  const webSocketRequest = await webSocketRequestFlow.create(
    realtimeCollection,
    new WebSocketRequest({
      name: faker.string.alpha(10),
      url: `${WS_SERVER}/`,
      params: [{ name: 'room', value: faker.string.alphanumeric(6) }],
      headers: [{ name: 'X-Token', value: faker.string.alphanumeric(8) }],
    }),
  );
  const socketIoRequest = await socketIoRequestFlow.create(
    realtimeCollection,
    new SocketIORequest({
      name: faker.string.alpha(10),
      url: HTTP_SERVER,
      headers: [{ name: 'X-Token', value: faker.string.alphanumeric(8) }],
    }),
  );
  const mockServer = await mockServerFlow.create(project, new MockServer(faker.string.alphanumeric(10), MOCK_BIN_SERVER));
  const mockRoute = await mockServerFlow.createRoute(mockServer, {
    path: `/${faker.string.alpha(8)}`,
    method: HttpMethod.Post,
    statusCode: 201,
    statusText: 'Created',
    bodyType: MockBodyType.Json,
    body: '{"ok":true}',
  });
  const mcpClient = await mcpClientFlow.create(project, new McpClient(faker.string.alphanumeric(10), MCP_SERVER));
  await expect
    .poll(async () => (await gitSyncFlow.getChanges()).unstaged.length, { timeout: DEFAULT_TIMEOUT })
    .toBe(4);

  await gitSyncPage.openCommitDialog();
  await gitSyncPage.openChangeDiff(GitChangeList.Unstaged, `${httpBaseName}.yaml`);
  const defaultView = await gitSyncPage.getDiffView();
  const hasTextOption = await gitSyncPage.hasDiffViewOption(GitDiffView.Text);
  const hasVisualOption = await gitSyncPage.hasDiffViewOption(GitDiffView.Visual);
  await gitSyncPage.switchDiffView(GitDiffView.Visual);
  const httpHeader = await gitSyncPage.getEntityCardHeader(httpRequest.name);
  const httpTabs = await gitSyncPage.getEntityCardTabs(httpRequest.name);
  const httpSections: Record<string, string> = {};
  for (const tab of ['Params', 'Body', 'Auth', 'Headers', 'Scripts']) {
    await gitSyncPage.selectEntityCardTab(httpRequest.name, tab);
    httpSections[tab] = await gitSyncPage.getEntityCardText(httpRequest.name);
  }
  const httpFormatWarningAbsent = await gitSyncPage.isVisualDiffFormatWarningAbsent();

  await gitSyncPage.openChangeDiff(GitChangeList.Unstaged, `${realtimeBaseName}.yaml`);
  const viewAfterSwitchingFile = await gitSyncPage.getDiffView();
  const webSocketHeader = await gitSyncPage.getEntityCardHeader(webSocketRequest.name);
  const webSocketTabs = await gitSyncPage.getEntityCardTabs(webSocketRequest.name);
  await gitSyncPage.selectEntityCardTab(webSocketRequest.name, 'Headers');
  const webSocketHeadersText = await gitSyncPage.getEntityCardText(webSocketRequest.name);
  const socketIoHeader = await gitSyncPage.getEntityCardHeader(socketIoRequest.name);
  const socketIoTabs = await gitSyncPage.getEntityCardTabs(socketIoRequest.name);
  const socketIoText = await gitSyncPage.getEntityCardText(socketIoRequest.name);

  await gitSyncPage.openChangeDiff(GitChangeList.Unstaged, `${mockServer.name.toLowerCase()}.yaml`);
  const routeText = await gitSyncPage.getEntityCardText(mockRoute.path);
  const routeTabs = await gitSyncPage.getEntityCardTabs(mockRoute.path);
  const serverText = await gitSyncPage.getEntityCardText(MOCK_BIN_SERVER, 'Mock Server');

  await gitSyncPage.openChangeDiff(GitChangeList.Unstaged, `${mcpClient.name.toLowerCase()}.yaml`);
  const mcpHeader = await gitSyncPage.getEntityCardHeader('MCP Request');

  expect(defaultView).toBe(GitDiffView.Text);
  expect(hasTextOption).toBe(true);
  expect(hasVisualOption).toBe(true);
  expect(viewAfterSwitchingFile).toBe(GitDiffView.Visual);
  expect(httpHeader).toMatchObject({ badge: 'POST', name: httpRequest.name, url: httpRequest.url, onOneLine: true });
  expect(httpTabs).toEqual(['Params 1', 'Body', 'Auth', 'Headers 2', 'Scripts']);
  expect(httpSections.Params).toContain('page');
  expect(httpSections.Body).toContain('application/json');
  expect(httpSections.Body).toContain('{"key":"value"}');
  expect(httpSections.Auth).toContain('client_credentials');
  expect(httpSections.Auth).toContain(`${OAUTH2_SERVER}/token`);
  expect(httpSections.Headers).toContain('X-Trace');
  expect(httpSections.Scripts).toContain("console.log('pre');");
  expect(httpSections.Scripts).toContain("console.log('after');");
  expect(httpFormatWarningAbsent).toBe(true);
  expect(webSocketHeader).toEqual({ badge: 'WS', name: webSocketRequest.name, url: webSocketRequest.url, onOneLine: true });
  expect(webSocketTabs).toEqual(['Params 1', 'Headers 1']);
  expect(webSocketHeadersText).toContain('X-Token');
  expect(socketIoHeader).toEqual({ badge: 'IO', name: socketIoRequest.name, url: socketIoRequest.url, onOneLine: true });
  expect(socketIoTabs).toEqual(['Headers 1']);
  expect(socketIoText).toContain('X-Token');
  expect(routeText).toContain(`POST\n${mockRoute.path}\n201 Created`);
  expect(routeTabs).toEqual(['Body']);
  expect(routeText).toContain('application/json');
  expect(routeText).toContain('{"ok":true}');
  expect(serverText).toContain(MOCK_BIN_SERVER);
  expect(mcpHeader).toEqual({ badge: 'MCP', name: 'MCP Request', url: `HTTP ${MCP_SERVER}`, onOneLine: true });
});
