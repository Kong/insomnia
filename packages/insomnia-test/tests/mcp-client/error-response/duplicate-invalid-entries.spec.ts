import { faker } from '@faker-js/faker';
import { expect } from "@playwright/test";

import { McpPrimitiveType } from '../../../enums/mcp-capability';
import { ProjectType } from '../../../enums/project-types';
import { DEFAULT_TIMEOUT, test } from "../../../misc/fixtures";
import { scriptMcpListServer } from '../../../misc/mcp-list-server';
import { McpClient } from '../../../models/mcp-client';
import { Project } from '../../../models/project';
import { skippedTitle, validTool } from './helpers';

test('Verify Invalid Entries Sharing One Name Are All Listed Per Response Alongside a Valid Entry of That Name', async ({
  user,
}) => {
  test.fail(true, 'INS-4130');
  const { mcpClientFlow, workspaceFlow } = user.flowManager;
  const { mcpClientPage } = user.pageManager;

  const sharedName = faker.string.alphanumeric(8);
  const url = await scriptMcpListServer(faker.string.alphanumeric(12), {
    'tools/list': {
      result: {
        tools: [
          { name: sharedName, inputSchema: { type: 'object' } },
          validTool,
          { name: sharedName, inputSchema: { type: 'object' } },
          { name: sharedName },
          { name: sharedName },
        ],
      },
    },
    'resources/list': {
      result: { resources: [{ uri: 'file:///valid.txt', name: sharedName }, { name: sharedName }, { name: sharedName }] },
    },
    'resources/templates/list': {
      result: { resourceTemplates: [{ uriTemplate: 'file:///{path}', name: sharedName }, { name: sharedName }] },
    },
    'prompts/list': {
      result: {
        prompts: [{ name: sharedName }, { name: sharedName, arguments: 'x' }, { name: sharedName, arguments: 'y' }],
      },
    },
  });
  const project = await workspaceFlow.createProject(new Project(faker.string.alphanumeric(10), ProjectType.Local));
  const client = await mcpClientFlow.create(project, new McpClient(faker.string.alphanumeric(10), url));
  await mcpClientFlow.connect(client);

  const toolsError = await mcpClientFlow.getListError(client, McpPrimitiveType.Tools);
  const resourcesError = await mcpClientFlow.getListError(client, McpPrimitiveType.Resources);
  const promptsError = await mcpClientFlow.getListError(client, McpPrimitiveType.Prompts);

  expect(toolsError.title).toMatch(skippedTitle(3));
  expect(toolsError.entries.map(entry => entry.label)).toEqual([sharedName, sharedName, sharedName]);
  expect(resourcesError.entries.map(entry => entry.label)).toEqual([sharedName, sharedName, sharedName]);
  expect(resourcesError.entries.map(entry => entry.reason)).toEqual([
    expect.stringMatching(/^uri:/),
    expect.stringMatching(/^uri:/),
    expect.stringMatching(/^uriTemplate:/),
  ]);
  expect(promptsError.title).toMatch(skippedTitle(2));
  expect(promptsError.entries.map(entry => entry.label)).toEqual([sharedName, sharedName]);
  await expect
    .poll(() => mcpClientPage.getPrimitives(McpPrimitiveType.Tools), { timeout: DEFAULT_TIMEOUT })
    .toEqual([sharedName, validTool.name]);
  for (const type of [McpPrimitiveType.Resources, McpPrimitiveType.Prompts, McpPrimitiveType.ResourceTemplates]) {
    await expect
      .poll(() => mcpClientPage.getPrimitives(type), { timeout: DEFAULT_TIMEOUT })
      .toEqual([sharedName]);
  }
});
