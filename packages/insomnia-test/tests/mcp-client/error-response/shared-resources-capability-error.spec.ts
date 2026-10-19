import { faker } from '@faker-js/faker';

import { ProjectType } from '../../../enums/project-types';
import { DEFAULT_TIMEOUT, expect, test } from '../../../misc/fixtures';
import { scriptMcpListServer } from '../../../misc/mcp-list-server';
import { McpClient } from '../../../models/mcp-client';
import { Project } from '../../../models/project';
import { wholeFailureTitle } from './helpers';

test('Verify Resources and Resource Templates Errors Share One Capability Item Panel', async ({ user }) => {
  const { mcpClientFlow, workspaceFlow } = user.flowManager;
  const { mcpClientPage } = user.pageManager;
  const url = await scriptMcpListServer(faker.string.alphanumeric(12), {
    'resources/list': { result: { resources: null } },
    'resources/templates/list': {
      result: {
        resourceTemplates: [{ uriTemplate: 'file:///{path}', name: 'valid-template' }, { name: 'no-uri-template' }],
      },
    },
  });
  const project = await workspaceFlow.create(new Project(faker.string.alphanumeric(10), ProjectType.Local));
  const client = await mcpClientFlow.create(project, new McpClient(faker.string.alphanumeric(10), url));
  await mcpClientFlow.connect(client);

  const error = await mcpClientFlow.getListError(client, 'resources');
  await expect.poll(() => mcpClientPage.getCapabilityErrorCount('resources')).toBe(1);
  expect(error.title).toContain(wholeFailureTitle('resources/list'));
  expect(error.title).toContain('skipped because they do not match the MCP schema');
  expect(error.entries.map(entry => entry.label)).toEqual(['no-uri-template']);
  await expect
    .poll(() => mcpClientPage.getPrimitives('resourceTemplates'), {
      timeout: DEFAULT_TIMEOUT,
    })
    .toEqual(['valid-template']);
});
