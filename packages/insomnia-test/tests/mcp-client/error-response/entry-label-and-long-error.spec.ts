import { faker } from '@faker-js/faker';

import { ProjectType } from '../../../enums/project-types';
import { expect, test } from '../../../misc/fixtures';
import { scriptMcpListServer } from '../../../misc/mcp-list-server';
import { McpClient } from '../../../models/mcp-client';
import { Project } from '../../../models/project';
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
  const project = await workspaceFlow.create(new Project(faker.string.alphanumeric(10), ProjectType.Local));
  const client = await mcpClientFlow.create(project, new McpClient(faker.string.alphanumeric(10), url));
  await mcpClientFlow.connect(client);

  const error = await mcpClientFlow.getListError(client, 'tools');
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
  const project = await workspaceFlow.create(new Project(faker.string.alphanumeric(10), ProjectType.Local));
  const client = await mcpClientFlow.create(project, new McpClient(faker.string.alphanumeric(10), url));
  await mcpClientFlow.connect(client);

  const error = await mcpClientFlow.getListError(client, 'tools');
  expect(error.entries).toHaveLength(12);
  expect(await mcpClientPage.isCapabilityErrorScrollable('tools')).toBe(true);

  const panelBox = await mcpClientPage.getCapabilityErrorBounds('tools');
  const nextCapabilityBox = await mcpClientPage.getCapabilityBounds('prompts');
  expect(panelBox.y + panelBox.height).toBeLessThanOrEqual(nextCapabilityBox.y + 1);
});
