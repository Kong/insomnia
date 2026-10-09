import { faker } from '@faker-js/faker';

import { ProjectType } from '../../enums/project-types';
import { DEFAULT_TIMEOUT, expect, GIT_CREDENTIAL, pushServerFile, test } from '../../misc/git-fixtures';
import { buildCollectionFile } from '../../misc/git-fixtures';
import { Collection } from '../../models/collection';
import { Project } from '../../models/project';

test('Verify pulling brings in a collection that was pushed to the remote by another client', async ({ user }) => {
  const { gitSyncFlow, preferencesFlow, workspaceFlow } = user.flowManager;
  const { workspacePage } = user.pageManager;

  await preferencesFlow.addGitCredential(GIT_CREDENTIAL);
  await workspaceFlow.create(new Project(faker.string.alphanumeric(10), ProjectType.Git), GIT_CREDENTIAL.name);
  const remoteCollection = new Collection(faker.string.alpha(10));
  await pushServerFile({
    path: `${faker.string.alpha(10).toLowerCase()}.yaml`,
    content: buildCollectionFile(remoteCollection.name),
  });

  const nodeBeforePull = await workspacePage.findItemNode(remoteCollection);
  await gitSyncFlow.pull();

  expect(nodeBeforePull).toBeUndefined();
  await expect.poll(async () => workspacePage.findItemNode(remoteCollection), { timeout: DEFAULT_TIMEOUT }).toBeDefined();
});
