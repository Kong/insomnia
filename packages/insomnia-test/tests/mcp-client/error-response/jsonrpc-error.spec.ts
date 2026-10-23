import { faker } from '@faker-js/faker';

import { McpPrimitiveType } from '../../../enums/mcp-capability';
import { ProjectType } from '../../../enums/project-types';
import { expect, test } from '../../../misc/fixtures';
import { scriptMcpListServer } from '../../../misc/mcp-list-server';
import { McpClient } from '../../../models/mcp-client';
import { Project } from '../../../models/project';

const jsonRpcErrors = [
  { code: -32_601, message: 'Method not found' },
  { code: -32_603, message: 'Internal error' },
];

for (const rpcError of jsonRpcErrors) {
  test(`Verify a JSON-RPC Error on tools/list (${rpcError.message}) Is Shown`, async ({ user }) => {
    const { mcpClientFlow, workspaceFlow } = user.flowManager;
    const url = await scriptMcpListServer(faker.string.alphanumeric(12), {
      'tools/list': { error: rpcError },
    });
    const project = await workspaceFlow.create(new Project(faker.string.alphanumeric(10), ProjectType.Local));
    const client = await mcpClientFlow.create(project, new McpClient(faker.string.alphanumeric(10), url));
    await mcpClientFlow.connect(client);

    const error = await user.flowManager.mcpClientFlow.getListError(client, McpPrimitiveType.Tools);
    expect(error.title).toContain(rpcError.message);
    expect(error.entries).toEqual([]);
  });
}
