import { faker } from '@faker-js/faker';
import { expect } from "@playwright/test";

import { McpPrimitiveType } from '@package/enums/mcp-capability';
import { ProjectType } from '@package/enums/project-types';
import { test } from "@package/misc/fixtures";
import { scriptMcpListServer } from '@package/misc/mcp-list-server';
import { McpClient } from '@package/models/mcp-client';
import { Project } from '@package/models/project';

test('Verify a JSON-RPC Error Whose Message Is a JSON String Is Shown Readably', async ({ user }) => {
  const { mcpClientFlow, workspaceFlow } = user.flowManager;
  const url = await scriptMcpListServer(faker.string.alphanumeric(12), {
    'tools/list': { error: { code: -32_603, message: "{ detail: 'boom' }" } },
  });
  const project = await workspaceFlow.createProject(new Project(faker.string.alphanumeric(10), ProjectType.Local));
  const client = await mcpClientFlow.create(project, new McpClient(faker.string.alphanumeric(10), url));
  await mcpClientFlow.connect(client);

  const error = await user.flowManager.mcpClientFlow.getListError(client, McpPrimitiveType.Tools);

  expect(error.title).toContain('boom');
  expect(error.title).not.toContain('[object Object]');
});
