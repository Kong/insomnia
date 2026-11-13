import { faker } from '@faker-js/faker';
import { McpPrimitiveType } from '@package/enums/mcp-capability';
import { ProjectType } from '@package/enums/project-types';
import { DEFAULT_TIMEOUT, test } from "@package/misc/fixtures";
import { scriptMcpListServer } from '@package/misc/mcp-list-server';
import { McpClient } from '@package/models/mcp-client';
import { Project } from '@package/models/project';
import { expect } from "@playwright/test";

import { validTool } from './helpers';

test('Verify a Server-Initiated Request Reusing the tools/list Request Id Does Not Produce a Tools Error', async ({
  user,
}) => {
  test.fail(true, 'INS-4066');
  const { mcpClientPage } = user.pageManager;
  const { mcpClientFlow, workspaceFlow } = user.flowManager;
  const url = await scriptMcpListServer(faker.string.alphanumeric(12), {
    'tools/list': { result: { tools: [validTool] } },
    'serverRequestReusingToolsListId': true,
  });
  const project = await workspaceFlow.createProject(new Project(faker.string.alphanumeric(10), ProjectType.Local));
  const client = await mcpClientFlow.create(project, new McpClient(faker.string.alphanumeric(10), url));
  await mcpClientFlow.connect(client);

  await expect.poll(() => mcpClientPage.getPrimitives(McpPrimitiveType.Tools), { timeout: DEFAULT_TIMEOUT }).toEqual(['valid-tool']);
  expect(await mcpClientPage.getCapabilityErrorCount(McpPrimitiveType.Tools)).toBe(0);
});
