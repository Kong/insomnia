import { faker } from '@faker-js/faker';
import { expect } from "@playwright/test";

import { DEFAULT_TIMEOUT, MCP_SERVER, test } from "@package/misc/fixtures";
import { McpClient } from '@package/models/mcp-client';
import { commitEachChange, NO_ROW_WARNINGS, readRowWarnings } from './helpers';

test('Verify a Cloud Sync MCP client committed and then edited shows no unknown fields or unsupported warnings and commits without confirmation', async ({
  user,
}) => {
  const { workspaceFlow, mcpClientFlow } = user.flowManager;
  const { cloudSyncPage, mcpClientPage, cloudSyncCommitDialogPage } = user.pageManager;

  const project = await workspaceFlow.getProject({ name: 'Personal Workspace' });
  const client = await mcpClientFlow.create(project!, new McpClient(faker.string.alphanumeric(10), MCP_SERVER));
  await cloudSyncPage.openCommitDialog();
  const initialChangeNames = await cloudSyncCommitDialogPage.getChangeNames();
  await cloudSyncCommitDialogPage.closeCommitDialog();
  await commitEachChange(cloudSyncPage, cloudSyncCommitDialogPage, initialChangeNames);

  const renamed = faker.string.alphanumeric(10);
  await workspaceFlow.renameMcpClient(client, renamed);
  await mcpClientFlow.get(renamed);
  await mcpClientPage.setUrl(`${MCP_SERVER}?${faker.string.alpha(6)}=1`);
  await cloudSyncPage.openCommitDialog();
  const editedChangeNames = await cloudSyncCommitDialogPage.getChangeNames();
  const rowWarnings = await readRowWarnings(cloudSyncCommitDialogPage, editedChangeNames);
  await cloudSyncCommitDialogPage.closeCommitDialog();
  await commitEachChange(cloudSyncPage, cloudSyncCommitDialogPage, editedChangeNames);

  expect(initialChangeNames.length).toBeGreaterThan(0);
  expect(editedChangeNames.length).toBeGreaterThan(0);
  expect(rowWarnings).toEqual(editedChangeNames.map(() => NO_ROW_WARNINGS));
  await expect.poll(() => cloudSyncPage.isCommitDisabled(), { timeout: DEFAULT_TIMEOUT }).toBe(true);
});
