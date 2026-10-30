import { faker } from '@faker-js/faker';
import { expect } from "@playwright/test";

import { McpPrimitiveType } from '../../../enums/mcp-capability';
import { ProjectType } from '../../../enums/project-types';
import { DEFAULT_TIMEOUT, test } from "../../../misc/fixtures";
import { type McpListConfig, scriptMcpListServer } from '../../../misc/mcp-list-server';
import { McpClient } from '../../../models/mcp-client';
import { Project } from '../../../models/project';
import { validTool, wholeFailureTitle } from './helpers';

test('Verify Refresh Clears the Error Once the Server Returns Valid Data', async ({ user }) => {
  const { mcpClientFlow } = user.flowManager;
  const { mcpClientPage } = user.pageManager;
  const invalid: McpListConfig = { 'tools/list': { result: { tools: 'not-an-array' } } };
  const valid: McpListConfig = { 'tools/list': { result: { tools: [validTool] } } };
  const key = faker.string.alphanumeric(12);
  const url = await scriptMcpListServer(key, invalid);
  const project = await user.flowManager.workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const client = await mcpClientFlow.create(project, new McpClient(faker.string.alphanumeric(10), url));
  await mcpClientFlow.connect(client);
  await mcpClientFlow.getListError(client, McpPrimitiveType.Tools);

  await scriptMcpListServer(key, valid);
  await mcpClientFlow.refresh(client, McpPrimitiveType.Tools);
  await expect.poll(() => mcpClientPage.getCapabilityErrorCount(McpPrimitiveType.Tools)).toBe(0);
  await expect.poll(() => mcpClientPage.getPrimitives(McpPrimitiveType.Tools), { timeout: DEFAULT_TIMEOUT }).toEqual(['valid-tool']);

  await scriptMcpListServer(key, invalid);
  await mcpClientFlow.refresh(client, McpPrimitiveType.Tools);
  expect((await mcpClientFlow.getListError(client, McpPrimitiveType.Tools)).title).toBe(wholeFailureTitle('tools/list'));
});
