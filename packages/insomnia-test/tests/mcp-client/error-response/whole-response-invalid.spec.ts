import { faker } from '@faker-js/faker';
import { expect } from "@playwright/test";

import { McpPrimitiveType } from '../../../enums/mcp-capability';
import { ProjectType } from '../../../enums/project-types';
import { test } from "../../../misc/fixtures";
import { scriptMcpListServer } from '../../../misc/mcp-list-server';
import { McpClient } from '../../../models/mcp-client';
import { Project } from '../../../models/project';
import { wholeFailureTitle } from './helpers';

const wholeInvalidTools: Record<string, unknown> = {
  'tools is not an array': { tools: 'not-an-array' },
  'tools is null': { tools: null },
  'nextCursor has the wrong type': { tools: [], nextCursor: 123 },
};

for (const [variant, result] of Object.entries(wholeInvalidTools)) {
  test(`Verify a Whole tools/list Response Invalid (${variant}) Shows a Title-Only Error`, async ({ user }) => {
    const { mcpClientFlow, workspaceFlow } = user.flowManager;
    const url = await scriptMcpListServer(faker.string.alphanumeric(12), { 'tools/list': { result } });
    const project = await workspaceFlow.createProject(new Project(faker.string.alphanumeric(10), ProjectType.Local));
    const client = await mcpClientFlow.create(project, new McpClient(faker.string.alphanumeric(10), url));
    await mcpClientFlow.connect(client);

    expect(await mcpClientFlow.getListError(client, McpPrimitiveType.Tools)).toEqual({
      title: wholeFailureTitle('tools/list'),
      entries: [],
    });
    expect(await user.pageManager.mcpClientPage.getPrimitives(McpPrimitiveType.Tools)).toEqual([]);
  });
}

test('Verify a tools/list Result That Is Not an Object Shows an Error and Lists No Tools', async ({ user }) => {
  const { mcpClientFlow, workspaceFlow } = user.flowManager;
  const url = await scriptMcpListServer(faker.string.alphanumeric(12), { 'tools/list': { result: 'oops' } });
  const project = await workspaceFlow.createProject(new Project(faker.string.alphanumeric(10), ProjectType.Local));
  const client = await mcpClientFlow.create(project, new McpClient(faker.string.alphanumeric(10), url));
  await mcpClientFlow.connect(client);

  // The MCP SDK rejects a non-object `result` before the pane's own
  // validation runs, so the title is the SDK's ZodError, not the agreed
  // "does not match the MCP schema" wording.
  const error = await user.flowManager.mcpClientFlow.getListError(client, McpPrimitiveType.Tools);
  expect(error.title).not.toBe('');
  expect(error.entries).toEqual([]);
  expect(await user.pageManager.mcpClientPage.getPrimitives(McpPrimitiveType.Tools)).toEqual([]);
});
