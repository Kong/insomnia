import { faker } from '@faker-js/faker';
import { expect } from "@playwright/test";

import { GitChangeList } from '../../../enums/git-change-list';
import { HttpMethod } from '../../../enums/http-method';
import { ProjectType } from '../../../enums/project-types';
import { HTTP_SERVER } from '../../../misc/constants';
import { DEFAULT_TIMEOUT, GIT_CREDENTIAL, test } from "../../../misc/git-fixtures";
import { Collection } from '../../../models/collection';
import { Project } from '../../../models/project';

test('Verify a real edit shows no undiscardable warning in the diff or the discard confirmation', async ({ user }) => {
  const { gitSyncFlow, httpRequestFlow, preferencesFlow, workspaceFlow } = user.flowManager;
  const { gitSyncPage } = user.pageManager;

  await preferencesFlow.addGitCredential(GIT_CREDENTIAL);
  const project = await workspaceFlow.cloneGitProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Git),
    GIT_CREDENTIAL.name,
  );
  const fileName = faker.string.alpha(10).toLowerCase();
  const collection = await workspaceFlow.createCollection(project, new Collection(faker.string.alphanumeric(10)), fileName);
  const request = await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Get,
    url: `${HTTP_SERVER}/cookies`,
  });
  await gitSyncFlow.commit(faker.string.alphanumeric(10));
  await workspaceFlow.renameRequest(request, faker.string.alphanumeric(10));
  await expect
    .poll(async () => (await gitSyncFlow.getChanges()).unstaged.length, {
      timeout: DEFAULT_TIMEOUT,
    })
    .toBeGreaterThan(0);
  const unstaged = (await gitSyncFlow.getChanges()).unstaged[0];

  await gitSyncPage.openCommitDialog();
  await gitSyncPage.openChangeDiff(GitChangeList.Unstaged, unstaged);
  expect(await gitSyncPage.isUndiscardableWarningVisible()).toBe(false);

  await gitSyncPage.openDiscardConfirmation(unstaged);
  expect(await gitSyncPage.isUndiscardableWarningVisibleInDiscardDialog()).toBe(false);
});
