import { faker } from '@faker-js/faker';

import { GitChangeList } from '../../../enums/git-change-list';
import { ProjectType } from '../../../enums/project-types';
import { HTTP_SERVER } from '../../../misc/fixtures';
import { DEFAULT_TIMEOUT, expect, GIT_CREDENTIAL, test } from '../../../misc/git-fixtures';
import { Collection } from '../../../models/collection';
import { Project } from '../../../models/project';
import { SocketIORequest } from '../../../models/socket-io-request';

test('Verify a new Socket.IO request card shows its IO badge, URL and Headers tab', async ({ user }) => {
  const { gitSyncFlow, preferencesFlow, socketIoRequestFlow, workspaceFlow } = user.flowManager;
  const { gitSyncPage } = user.pageManager;

  await preferencesFlow.addGitCredential(GIT_CREDENTIAL);
  const project = await workspaceFlow.create(new Project(faker.string.alphanumeric(10), ProjectType.Git), GIT_CREDENTIAL.name);
  const baseName = faker.string.alpha(10).toLowerCase();
  const collection = await workspaceFlow.create(project, new Collection(faker.string.alphanumeric(10)), baseName);
  const request = await socketIoRequestFlow.create(
    collection,
    new SocketIORequest({
      name: faker.string.alpha(10),
      url: HTTP_SERVER,
      headers: [{ name: 'X-Token', value: faker.string.alphanumeric(8) }],
    }),
  );
  await expect.poll(async () => gitSyncPage.hasUncommittedChanges(), { timeout: DEFAULT_TIMEOUT }).toBe(true);

  await gitSyncFlow.openVisualDiff(GitChangeList.Unstaged, `${baseName}.yaml`);
  const header = await gitSyncPage.getEntityCardHeader(request.name);
  const tabs = await gitSyncPage.getEntityCardTabs(request.name);
  const cardText = await gitSyncPage.getEntityCardText(request.name);

  expect(header).toEqual({ badge: 'IO', name: request.name, url: request.url, onOneLine: true });
  expect(tabs).toEqual(['Headers 1']);
  expect(cardText).toContain('X-Token');
});
