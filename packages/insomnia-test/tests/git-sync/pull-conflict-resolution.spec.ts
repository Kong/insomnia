import { faker } from '@faker-js/faker';

import { ProjectType } from '../../enums/project-types';
import {
  buildCollectionFile,
  DEFAULT_TIMEOUT,
  expect,
  GIT_CREDENTIAL,
  pushServerFile,
  test,
} from '../../misc/git-fixtures';
import { Collection } from '../../models/collection';
import { Project } from '../../models/project';

for (const { version, keepsLocal } of [
  { version: 'Current', keepsLocal: true },
  { version: 'Incoming', keepsLocal: false },
] as const) {
  test(`Verify resolving a pull conflict by choosing the ${version} version keeps that side's collection name`, async ({
    user,
  }) => {
    const { gitSyncFlow, preferencesFlow, workspaceFlow } = user.flowManager;
    const { gitSyncPage, workspacePage } = user.pageManager;

    await preferencesFlow.addGitCredential(GIT_CREDENTIAL);
    const project = await workspaceFlow.create(
      new Project(faker.string.alphanumeric(10), ProjectType.Git),
      GIT_CREDENTIAL.name,
    );
    const fileName = faker.string.alpha(10).toLowerCase();
    const collection = await workspaceFlow.create(project, new Collection(faker.string.alphanumeric(10)), fileName);
    await gitSyncFlow.commitAndPush(faker.string.alphanumeric(10));

    const localCollection = new Collection(faker.string.alpha(10));
    const remoteCollection = new Collection(faker.string.alpha(10));
    await workspaceFlow.rename(collection, localCollection.name);
    await gitSyncFlow.commit(faker.string.alphanumeric(10));
    await pushServerFile({ path: `${fileName}.yaml`, content: buildCollectionFile(remoteCollection.name) });
    await gitSyncFlow.pull();
    await gitSyncPage.resolveMergeConflicts(version);

    const keptCollection = keepsLocal ? localCollection : remoteCollection;
    await expect
      .poll(async () => workspacePage.findItemNode(keptCollection), { timeout: DEFAULT_TIMEOUT })
      .toBeDefined();
    if (keepsLocal) {
      expect(await workspacePage.findItemNode(remoteCollection)).toBeUndefined();
    }
  });
}
