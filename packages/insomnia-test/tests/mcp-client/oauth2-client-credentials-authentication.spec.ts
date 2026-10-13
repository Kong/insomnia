import { faker } from '@faker-js/faker';

import { ProjectType } from '../../enums/project-types';
import {
  DEFAULT_TIMEOUT,
  expect,
  MCP_SERVER,
  OAUTH2_CLIENT_ID,
  OAUTH2_CLIENT_SECRET,
  OAUTH2_SERVER,
  test,
} from '../../misc/fixtures';
import { McpClient } from '../../models/mcp-client';
import { Project } from '../../models/project';

test('Verify MCP Client Sends the OAuth 2.0 Header Only When Authentication Is Configured', async ({ user }) => {
  const { mcpClientFlow, workspaceFlow } = user.flowManager;
  const { responsePage } = user.pageManager;

  const project = await workspaceFlow.create(new Project(faker.string.alphanumeric(10), ProjectType.Local));

  const authenticatedClient = await mcpClientFlow.create(
    project,
    new McpClient(faker.string.alphanumeric(10), MCP_SERVER, {
      type: 'oauth2',
      grantType: 'client_credentials',
      accessTokenUrl: `${OAUTH2_SERVER}/token`,
      clientId: OAUTH2_CLIENT_ID,
      clientSecret: OAUTH2_CLIENT_SECRET,
    }),
  );
  const tokens = await mcpClientFlow.fetchOAuth2Tokens(authenticatedClient);
  await mcpClientFlow.connect(authenticatedClient);
  const tools = await mcpClientFlow.getTools(authenticatedClient);

  await expect
    .poll(() => responsePage.getConsole(), { timeout: DEFAULT_TIMEOUT })
    .toContain(`authorization: Bearer ${tokens.accessToken}`);

  const unauthenticatedClient = await mcpClientFlow.create(
    project,
    new McpClient(faker.string.alphanumeric(10), MCP_SERVER),
  );
  await mcpClientFlow.connect(unauthenticatedClient);
  await mcpClientFlow.getTools(unauthenticatedClient);

  await expect
    .poll(() => responsePage.getConsole(), { timeout: DEFAULT_TIMEOUT })
    .toContain('JSON-RPC Method: initialize');
  expect(await responsePage.getConsole()).not.toContain('authorization:');
  expect(tools.length).toBeGreaterThan(0);
});
