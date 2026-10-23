import { faker } from '@faker-js/faker';

import { GitChangeList } from '../../../enums/git-change-list';
import { ProjectType } from '../../../enums/project-types';
import { MCP_SERVER } from '../../../misc/constants';
import { DEFAULT_TIMEOUT, expect, GIT_CREDENTIAL, test } from '../../../misc/git-fixtures';
import { McpClient } from '../../../models/mcp-client';
import { Project } from '../../../models/project';

test('Verify a new MCP card shows its MCP badge, transport and URL', async ({ user }) => {
  const { gitSyncFlow, mcpClientFlow, preferencesFlow, workspaceFlow } = user.flowManager;
  const { gitSyncPage } = user.pageManager;

  await preferencesFlow.addGitCredential(GIT_CREDENTIAL);
  const project = await workspaceFlow.create(new Project(faker.string.alphanumeric(10), ProjectType.Git), GIT_CREDENTIAL.name);
  const client = await mcpClientFlow.create(project, new McpClient(faker.string.alphanumeric(10), MCP_SERVER));
  await expect.poll(async () => gitSyncPage.hasUncommittedChanges(), { timeout: DEFAULT_TIMEOUT }).toBe(true);

  await gitSyncFlow.openVisualDiff(GitChangeList.Unstaged, `${client.name.toLowerCase()}.yaml`);
  const header = await gitSyncPage.getEntityCardHeader('MCP Request');

  expect(header).toEqual({ badge: 'MCP', name: 'MCP Request', url: `HTTP ${MCP_SERVER}`, onOneLine: true });
});
