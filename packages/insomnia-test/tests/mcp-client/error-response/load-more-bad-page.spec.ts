import { faker } from '@faker-js/faker';

import { McpListAction, McpPrimitiveType } from '../../../enums/mcp-capability';
import { ProjectType } from '../../../enums/project-types';
import { DEFAULT_TIMEOUT, expect, test } from '../../../misc/fixtures';
import { scriptMcpListServer } from '../../../misc/mcp-list-server';
import { McpClient } from '../../../models/mcp-client';
import { Project } from '../../../models/project';

const loadMoreVariants = [
  {
    type: McpPrimitiveType.Tools,
    method: 'tools/list',
    entry: (name: string) => ({ name, inputSchema: { type: 'object' } }),
    badEntry: { name: 'bad-tool' },
  },
  {
    type: McpPrimitiveType.Prompts,
    method: 'prompts/list',
    entry: (name: string) => ({ name }),
    badEntry: { name: 'bad-prompt', arguments: 'x' },
  },
  {
    type: McpPrimitiveType.Resources,
    method: 'resources/list',
    entry: (name: string) => ({ name, uri: `file:///${name}.txt` }),
    badEntry: { name: 'bad-resource' },
  },
] as const;

// Open app bugs: listTools() / listPrompts() do not forward the cursor, so Load More re-requests the first page.
// Resources forwards it and passes.
const knownBugs: Partial<Record<(typeof loadMoreVariants)[number]['type'], string>> = {
  [McpPrimitiveType.Tools]: 'INS-4060',
  [McpPrimitiveType.Prompts]: 'INS-4061',
};

for (const { type, method, entry, badEntry } of loadMoreVariants) {
  test(`Verify Load More on ${type} with a Bad Page Keeps Loaded Entries and Clears the Cursor`, async ({ user }) => {
    test.fail(type in knownBugs, knownBugs[type]);
    const { mcpClientFlow, workspaceFlow } = user.flowManager;
    const { mcpClientPage } = user.pageManager;
    const url = await scriptMcpListServer(faker.string.alphanumeric(12), {
      [method]: {
        pages: {
          '': { result: { [type]: [entry('item-1')], nextCursor: 'page-2' } },
          'page-2': { result: { [type]: [entry('item-2'), badEntry] } },
        },
      },
    });
    const project = await workspaceFlow.create(new Project(faker.string.alphanumeric(10), ProjectType.Local));
    const client = await mcpClientFlow.create(project, new McpClient(faker.string.alphanumeric(10), url));
    await mcpClientFlow.connect(client);
    await expect.poll(() => mcpClientPage.getPrimitives(type), { timeout: DEFAULT_TIMEOUT }).toEqual(['item-1']);
    expect(await mcpClientFlow.getListAction(client, type)).toBe(McpListAction.LoadMore);

    await mcpClientFlow.loadMore(client, type);
    await expect
      .poll(() => mcpClientPage.getPrimitives(type), { timeout: DEFAULT_TIMEOUT })
      .toEqual(['item-1', 'item-2']);
    expect(await mcpClientFlow.getListAction(client, type)).toBe(McpListAction.Refresh);
  });
}
