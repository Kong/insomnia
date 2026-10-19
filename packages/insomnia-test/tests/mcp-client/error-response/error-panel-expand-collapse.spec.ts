import { faker } from '@faker-js/faker';

import { McpPrimitiveType } from '../../../enums/mcp-capability';
import { ProjectType } from '../../../enums/project-types';
import { expect, test } from '../../../misc/fixtures';
import { scriptMcpListServer } from '../../../misc/mcp-list-server';
import { McpClient } from '../../../models/mcp-client';
import { Project } from '../../../models/project';
import { validTool } from './helpers';

test('Verify the Error Panel of a Partially Invalid List Follows Expand and Collapse', async ({ user }) => {
  const { mcpClientFlow, workspaceFlow } = user.flowManager;
  const { mcpClientPage } = user.pageManager;
  const url = await scriptMcpListServer(faker.string.alphanumeric(12), {
    'tools/list': {
      result: { tools: [validTool, { name: 'no-schema-tool' }] },
    },
    'prompts/list': { result: { prompts: [{ name: 'valid-prompt' }] } },
  });
  const project = await workspaceFlow.create(new Project(faker.string.alphanumeric(10), ProjectType.Local));
  const client = await mcpClientFlow.create(project, new McpClient(faker.string.alphanumeric(10), url));
  await mcpClientFlow.connect(client);
  await mcpClientFlow.getListError(client, McpPrimitiveType.Tools);
  await expect.poll(() => mcpClientPage.hasCapability(McpPrimitiveType.Prompts)).toBe(true);

  const panelBox = await mcpClientPage.getCapabilityErrorBounds(McpPrimitiveType.Tools);
  const nextCapabilityBox = await mcpClientPage.getCapabilityBounds(McpPrimitiveType.Prompts);
  expect(panelBox.y + panelBox.height).toBeLessThanOrEqual(nextCapabilityBox.y + 1);

  await mcpClientFlow.toggleCapability(client, McpPrimitiveType.Tools);
  await expect.poll(() => mcpClientPage.getCapabilityErrorCount(McpPrimitiveType.Tools)).toBe(0);

  await mcpClientFlow.toggleCapability(client, McpPrimitiveType.Tools);
  await expect.poll(() => mcpClientPage.getCapabilityErrorCount(McpPrimitiveType.Tools)).toBe(1);
});

test('Verify the Error Panel of an Empty List Stays Visible Without a Collapse Caret', async ({ user }) => {
  const { mcpClientFlow, workspaceFlow } = user.flowManager;
  const { mcpClientPage } = user.pageManager;
  const url = await scriptMcpListServer(faker.string.alphanumeric(12), {
    'tools/list': { result: { tools: 'not-an-array' } },
  });
  const project = await workspaceFlow.create(new Project(faker.string.alphanumeric(10), ProjectType.Local));
  const client = await mcpClientFlow.create(project, new McpClient(faker.string.alphanumeric(10), url));
  await mcpClientFlow.connect(client);
  await mcpClientFlow.getListError(client, McpPrimitiveType.Tools);

  expect(await mcpClientPage.hasCaret(McpPrimitiveType.Tools)).toBe(false);
  await mcpClientFlow.toggleCapability(client, McpPrimitiveType.Tools);
  await expect.poll(() => mcpClientPage.getCapabilityErrorCount(McpPrimitiveType.Tools)).toBe(1);
});
