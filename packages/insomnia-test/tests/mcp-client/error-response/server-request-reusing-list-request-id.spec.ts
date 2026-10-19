import { faker } from '@faker-js/faker';

import { ProjectType } from '../../../enums/project-types';
import { DEFAULT_TIMEOUT, expect, test } from '../../../misc/fixtures';
import { scriptMcpListServer } from '../../../misc/mcp-list-server';
import { McpClient } from '../../../models/mcp-client';
import { Project } from '../../../models/project';
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
  const project = await workspaceFlow.create(new Project(faker.string.alphanumeric(10), ProjectType.Local));
  const client = await mcpClientFlow.create(project, new McpClient(faker.string.alphanumeric(10), url));
  await mcpClientFlow.connect(client);

  await expect.poll(() => mcpClientPage.getPrimitives('tools'), { timeout: DEFAULT_TIMEOUT }).toEqual(['valid-tool']);
  expect(await mcpClientPage.getCapabilityErrorCount('tools')).toBe(0);
});
