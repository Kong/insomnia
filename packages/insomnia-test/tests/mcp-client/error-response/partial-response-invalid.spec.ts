import { faker } from '@faker-js/faker';

import { ProjectType } from '../../../enums/project-types';
import { DEFAULT_TIMEOUT, expect, test } from '../../../misc/fixtures';
import { scriptMcpListServer } from '../../../misc/mcp-list-server';
import { McpClient } from '../../../models/mcp-client';
import { Project } from '../../../models/project';
import { skippedTitle, validTool } from './helpers';

const partialInvalidTools: Record<string, { tools: unknown[]; skipped: string[] }> = {
  'missing or invalid inputSchema': {
    tools: [
      { ...validTool, description: 'ok', inputSchema: { type: 'object', properties: {} } },
      { name: 'no-schema-tool', description: 'missing inputSchema' },
      { name: 'bad-schema-tool', inputSchema: { type: 'string' } },
    ],
    skipped: ['no-schema-tool', 'bad-schema-tool'],
  },
  'missing or non-string name': {
    tools: [validTool, { inputSchema: { type: 'object' } }, { name: 123, inputSchema: { type: 'object' } }],
    skipped: ['index 1', 'index 2'],
  },
};

for (const [variant, { tools, skipped }] of Object.entries(partialInvalidTools)) {
  test(`Verify a Partially Invalid tools/list (${variant}) Skips the Bad Entries and Lists Them`, async ({ user }) => {
    const { mcpClientFlow, workspaceFlow } = user.flowManager;
    const { mcpClientPage } = user.pageManager;
    const url = await scriptMcpListServer(faker.string.alphanumeric(12), { 'tools/list': { result: { tools } } });
    const project = await workspaceFlow.create(new Project(faker.string.alphanumeric(10), ProjectType.Local));
    const client = await mcpClientFlow.create(project, new McpClient(faker.string.alphanumeric(10), url));
    await mcpClientFlow.connect(client);

    const error = await mcpClientFlow.getListError(client, 'tools');
    expect(error.title).toMatch(skippedTitle(2));
    expect(error.entries.map(entry => entry.label)).toEqual(skipped);
    for (const entry of error.entries) {
      expect(entry.reason).not.toBe('');
    }
    await expect
      .poll(() => mcpClientPage.getPrimitives('tools'), {
        timeout: DEFAULT_TIMEOUT,
      })
      .toEqual(['valid-tool']);
  });
}
