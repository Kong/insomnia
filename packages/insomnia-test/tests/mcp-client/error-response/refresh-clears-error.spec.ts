import { faker } from '@faker-js/faker';

import { ProjectType } from '../../../enums/project-types';
import { DEFAULT_TIMEOUT, expect, test } from '../../../misc/fixtures';
import { type McpListConfig, scriptMcpListServer } from '../../../misc/mcp-list-server';
import { McpClient } from '../../../models/mcp-client';
import { Project } from '../../../models/project';
import { validTool, wholeFailureTitle } from './helpers';

test('Verify Refresh Clears the Error Once the Server Returns Valid Data', async ({ user }) => {
  const { mcpClientFlow } = user.flowManager;
  const { mcpClientPage } = user.pageManager;
  const invalid: McpListConfig = { 'tools/list': { result: { tools: 'not-an-array' } } };
  const valid: McpListConfig = { 'tools/list': { result: { tools: [validTool] } } };
  const key = faker.string.alphanumeric(12);
  const url = await scriptMcpListServer(key, invalid);
  const project = await user.flowManager.workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const client = await mcpClientFlow.create(project, new McpClient(faker.string.alphanumeric(10), url));
  await mcpClientFlow.connect(client);
  await mcpClientFlow.getListError(client, 'tools');

  await scriptMcpListServer(key, valid);
  await mcpClientFlow.refresh(client, 'tools');
  await expect.poll(() => mcpClientPage.getCapabilityErrorCount('tools')).toBe(0);
  await expect.poll(() => mcpClientPage.getPrimitives('tools'), { timeout: DEFAULT_TIMEOUT }).toEqual(['valid-tool']);

  await scriptMcpListServer(key, invalid);
  await mcpClientFlow.refresh(client, 'tools');
  expect((await mcpClientFlow.getListError(client, 'tools')).title).toBe(wholeFailureTitle('tools/list'));
});
