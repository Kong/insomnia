import { faker } from '@faker-js/faker';
import { McpPrimitiveType } from '@package/enums/mcp-capability';
import { ProjectType } from '@package/enums/project-types';
import { test } from "@package/misc/fixtures";
import { scriptMcpListServer } from '@package/misc/mcp-list-server';
import { McpClient } from '@package/models/mcp-client';
import { Project } from '@package/models/project';
import { expect } from "@playwright/test";

import { validTool } from './helpers';

test('Verify an Entry Without a Usable Name Is Labeled by Its Position and Shows Its First Issue', async ({ user }) => {
  const { mcpClientFlow, workspaceFlow } = user.flowManager;
  const url = await scriptMcpListServer(faker.string.alphanumeric(12), {
    'tools/list': {
      result: {
        tools: [validTool, 42, 'just-a-string', null, { name: 123, description: 456, inputSchema: 'not-an-object' }],
      },
    },
  });
  const project = await workspaceFlow.createProject(new Project(faker.string.alphanumeric(10), ProjectType.Local));
  const client = await mcpClientFlow.create(project, new McpClient(faker.string.alphanumeric(10), url));
  await mcpClientFlow.connect(client);

  const error = await mcpClientFlow.getListError(client, McpPrimitiveType.Tools);
  expect(error.entries.map(entry => entry.label)).toEqual(['index 1', 'index 2', 'index 3', 'index 4']);
  expect(error.entries[3].reason).toMatch(/\(And \d+ more\)$/);
});

test('Verify a Long Error Panel Scrolls Inside Its Own Area Without Overlapping the Next Row', async ({ user }) => {
  const { mcpClientFlow, workspaceFlow } = user.flowManager;
  const { mcpClientPage } = user.pageManager;
  const badTools = Array.from({ length: 12 }, (_, i) => ({ name: `bad-${i + 1}` }));
  const url = await scriptMcpListServer(faker.string.alphanumeric(12), {
    'tools/list': { result: { tools: [validTool, ...badTools] } },
    'prompts/list': { result: { prompts: [{ name: 'valid-prompt' }] } },
  });
  const project = await workspaceFlow.createProject(new Project(faker.string.alphanumeric(10), ProjectType.Local));
  const client = await mcpClientFlow.create(project, new McpClient(faker.string.alphanumeric(10), url));
  await mcpClientFlow.connect(client);

  const error = await mcpClientFlow.getListError(client, McpPrimitiveType.Tools);
  expect(error.entries).toHaveLength(12);
  expect(await mcpClientPage.isCapabilityErrorScrollable(McpPrimitiveType.Tools)).toBe(true);

  const panelBox = await mcpClientPage.getCapabilityErrorBounds(McpPrimitiveType.Tools);
  const nextCapabilityBox = await mcpClientPage.getCapabilityBounds(McpPrimitiveType.Prompts);
  expect(panelBox.y + panelBox.height).toBeLessThanOrEqual(nextCapabilityBox.y + 1);
});
