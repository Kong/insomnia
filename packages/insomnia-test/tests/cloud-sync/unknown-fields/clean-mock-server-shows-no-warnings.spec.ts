import { faker } from '@faker-js/faker';
import { expect } from "@playwright/test";

import { HttpMethod } from '@package/enums/http-method';
import { DEFAULT_TIMEOUT, MOCK_BIN_SERVER, test } from "@package/misc/fixtures";
import { MockServer } from '@package/models/mock-server';
import { commitEachChange, NO_ROW_WARNINGS, readRowWarnings } from './helpers';

test('Verify a Cloud Sync mock server with routes committed and then edited shows no unknown fields or unsupported warnings and commits without confirmation', async ({
  user,
}) => {
  const { workspaceFlow, mockServerFlow } = user.flowManager;
  const { cloudSyncPage, cloudSyncCommitDialogPage } = user.pageManager;

  const project = await workspaceFlow.getProject({ name: 'Personal Workspace' });
  const server = await mockServerFlow.create(project!, new MockServer(faker.string.alphanumeric(10), MOCK_BIN_SERVER));
  const route = await mockServerFlow.createRoute(server, {
    path: `/${faker.string.alphanumeric(8)}`,
    method: HttpMethod.Post,
    statusCode: 201,
    body: faker.string.alpha(10),
  });
  await mockServerFlow.createRoute(server, { path: `/${faker.string.alphanumeric(8)}` });
  await cloudSyncPage.openCommitDialog();
  const initialChangeNames = await cloudSyncCommitDialogPage.getChangeNames();
  await cloudSyncCommitDialogPage.closeCommitDialog();
  await commitEachChange(cloudSyncPage, cloudSyncCommitDialogPage, initialChangeNames);

  await mockServerFlow.editRoute(route, { path: `/${faker.string.alphanumeric(8)}`, method: HttpMethod.Put });
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
