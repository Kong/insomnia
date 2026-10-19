import { faker } from '@faker-js/faker';

import { McpPrimitiveType } from '../../../enums/mcp-capability';
import { ProjectType } from '../../../enums/project-types';
import { expect, test } from '../../../misc/fixtures';
import { scriptMcpListServer } from '../../../misc/mcp-list-server';
import { McpClient } from '../../../models/mcp-client';
import { Project } from '../../../models/project';

test('Verify a JSON-RPC Error Whose Message Is a JSON String Is Shown Readably', async ({ user }) => {
  const { mcpClientFlow, workspaceFlow } = user.flowManager;
  const url = await scriptMcpListServer(faker.string.alphanumeric(12), {
    'tools/list': { error: { code: -32_603, message: "{ detail: 'boom' }" } },
  });
  const project = await workspaceFlow.create(new Project(faker.string.alphanumeric(10), ProjectType.Local));
  const client = await mcpClientFlow.create(project, new McpClient(faker.string.alphanumeric(10), url));
  await mcpClientFlow.connect(client);

  const error = await user.flowManager.mcpClientFlow.getListError(client, McpPrimitiveType.Tools);

  expect(error.title).toContain('boom');
  expect(error.title).not.toContain('[object Object]');
});
