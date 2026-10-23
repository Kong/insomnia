import { faker } from '@faker-js/faker';

import { McpPrimitiveType } from '../../../enums/mcp-capability';
import { ProjectType } from '../../../enums/project-types';
import { DEFAULT_TIMEOUT, expect, test } from '../../../misc/fixtures';
import { scriptMcpListServer } from '../../../misc/mcp-list-server';
import { McpClient } from '../../../models/mcp-client';
import { Project } from '../../../models/project';

test('Verify Load More Whose Next Page Has an Invalid Entry Lists the Skipped Entry in the Error Panel', async ({
  user,
}) => {
  const { mcpClientFlow, workspaceFlow } = user.flowManager;
  const { mcpClientPage } = user.pageManager;
  const url = await scriptMcpListServer(faker.string.alphanumeric(12), {
    'resources/list': {
      pages: {
        '': {
          result: {
            resources: [{ name: 'item-1', uri: 'file:///item-1.txt' }],
            nextCursor: 'page-2',
          },
        },
        'page-2': {
          result: {
            resources: [{ name: 'item-2', uri: 'file:///item-2.txt' }, { name: 'bad-resource' }],
          },
        },
      },
    },
  });
  const project = await workspaceFlow.create(new Project(faker.string.alphanumeric(10), ProjectType.Local));
  const client = await mcpClientFlow.create(project, new McpClient(faker.string.alphanumeric(10), url));
  await mcpClientFlow.connect(client);
  await expect.poll(() => mcpClientPage.getPrimitives(McpPrimitiveType.Resources), { timeout: DEFAULT_TIMEOUT }).toEqual(['item-1']);

  await mcpClientFlow.loadMore(client, McpPrimitiveType.Resources);
  await expect
    .poll(() => mcpClientPage.getPrimitives(McpPrimitiveType.Resources), { timeout: DEFAULT_TIMEOUT })
    .toEqual(['item-1', 'item-2']);
  const error = await mcpClientFlow.getListError(client, McpPrimitiveType.Resources);

  expect(error.entries.map(entry => entry.label)).toEqual(['bad-resource']);
});
