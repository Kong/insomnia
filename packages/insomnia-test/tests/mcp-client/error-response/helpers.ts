import { faker } from '@faker-js/faker';

import { ProjectType } from '../../../enums/project-types';
import type { test } from '../../../misc/fixtures';
import { type McpListConfig, scriptMcpListServer } from '../../../misc/mcp-list-server';
import { McpClient } from '../../../models/mcp-client';
import { Project } from '../../../models/project';

type User = Parameters<Parameters<typeof test>[2]>[0]['user'];

export const validTool = { name: 'valid-tool', inputSchema: { type: 'object' } };
export const wholeFailureTitle = (method: string) =>
  `The server returned a ${method} response that does not match the MCP schema.`;
// The wording of the skipped-entries title is still being settled (INS-3647
// notes): accept either the primitive name or "entries" as the noun.
export const skippedTitle = (count: number) =>
  new RegExp(
    `^${count} (entries|entry|tools?|resources?|prompts?) (was|were) skipped because they do not match the MCP schema\\.$`,
  );

/** Scripts a fresh list server, creates an MCP Client on it and connects. */
export async function connectTo(user: User, config: McpListConfig): Promise<McpClient> {
  const { mcpClientFlow, workspaceFlow } = user.flowManager;
  const url = await scriptMcpListServer(faker.string.alphanumeric(12), config);
  const project = await workspaceFlow.create(new Project(faker.string.alphanumeric(10), ProjectType.Local));
  const client = await mcpClientFlow.create(project, new McpClient(faker.string.alphanumeric(10), url));
  await mcpClientFlow.connect(client);
  return client;
}
