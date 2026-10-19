import { faker } from '@faker-js/faker';

import { ProjectType } from '../../../enums/project-types';
import { expect, test } from '../../../misc/fixtures';
import { scriptMcpListServer } from '../../../misc/mcp-list-server';
import { McpClient } from '../../../models/mcp-client';
import { Project } from '../../../models/project';
import { validTool } from './helpers';

test('Verify Invalid Entries With the Same Name and Issue Are All Listed', async ({
  user,
}) => {
  const { mcpClientFlow, workspaceFlow } = user.flowManager;

  const url = await scriptMcpListServer(faker.string.alphanumeric(12), {
    'tools/list': { result: { tools: [validTool, { name: 'dup' }, { name: 'dup' }] } },
  });
  const project = await workspaceFlow.create(new Project(faker.string.alphanumeric(10), ProjectType.Local));
  const client = await mcpClientFlow.create(project, new McpClient(faker.string.alphanumeric(10), url));
  await mcpClientFlow.connect(client);

  const error = await mcpClientFlow.getListError(client, 'tools');
  expect(error.entries.map(entry => entry.label)).toEqual(['dup', 'dup']);
});
