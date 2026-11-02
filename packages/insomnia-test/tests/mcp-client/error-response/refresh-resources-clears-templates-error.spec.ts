import { faker } from '@faker-js/faker';
import { McpPrimitiveType } from '@package/enums/mcp-capability';
import { ProjectType } from '@package/enums/project-types';
import { DEFAULT_TIMEOUT, test } from "@package/misc/fixtures";
import { scriptMcpListServer } from '@package/misc/mcp-list-server';
import { McpClient } from '@package/models/mcp-client';
import { Project } from '@package/models/project';
import { expect } from "@playwright/test";

test('Verify Refresh on Resources Clears a Resource Templates Error Once the Server Is Fixed', async ({ user }) => {
  test.fail(true, "INS-4065");
  const { mcpClientFlow, workspaceFlow } = user.flowManager;
  const { mcpClientPage } = user.pageManager;
  const resources = { result: { resources: [{ name: 'valid-resource', uri: 'file:///valid.txt' }] } };
  const key = faker.string.alphanumeric(12);
  const url = await scriptMcpListServer(key, {
    'resources/list': resources,
    'resources/templates/list': {
      result: {
        resourceTemplates: [{ uriTemplate: 'file:///{path}', name: 'valid-template' }, { name: 'no-template' }],
      },
    },
  });
  const project = await workspaceFlow.createProject(new Project(faker.string.alphanumeric(10), ProjectType.Local));
  const client = await mcpClientFlow.create(project, new McpClient(faker.string.alphanumeric(10), url));
  await mcpClientFlow.connect(client);
  await mcpClientFlow.getListError(client, McpPrimitiveType.Resources);

  await scriptMcpListServer(key, {
    'resources/list': resources,
    'resources/templates/list': {
      result: { resourceTemplates: [{ uriTemplate: 'file:///{path}', name: 'valid-template' }] },
    },
  });
  await mcpClientFlow.refresh(client, McpPrimitiveType.Resources);

  await expect.poll(() => mcpClientPage.getCapabilityErrorCount(McpPrimitiveType.Resources), { timeout: DEFAULT_TIMEOUT }).toBe(0);
});
