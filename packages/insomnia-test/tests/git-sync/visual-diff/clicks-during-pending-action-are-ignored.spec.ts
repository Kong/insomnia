import { faker } from '@faker-js/faker';

import { GitChangeList } from '../../../enums/git-change-list';
import { HttpMethod } from '../../../enums/http-method';
import { ProjectType } from '../../../enums/project-types';
import { HTTP_SERVER } from '../../../misc/fixtures';
import { DEFAULT_TIMEOUT, expect, GIT_CREDENTIAL,test } from '../../../misc/git-fixtures';
import { Collection } from '../../../models/collection';
import { HttpRequest } from '../../../models/http-request';
import { Project } from '../../../models/project';

test('Verify clicks during a pending action are ignored and consecutive actions do not overwrite each other', async ({ user }) => {
  const { gitSyncFlow, httpRequestFlow, preferencesFlow, workspaceFlow } = user.flowManager;
  const { gitSyncPage, httpRequestPage } = user.pageManager;

  await preferencesFlow.addGitCredential(GIT_CREDENTIAL);
  const project = await workspaceFlow.create(new Project(faker.string.alphanumeric(10), ProjectType.Git), GIT_CREDENTIAL.name);
  const baseName = faker.string.alpha(10).toLowerCase();
  const collection = await workspaceFlow.create(project, new Collection(faker.string.alphanumeric(10)), baseName);
  const fileName = `${baseName}.yaml`;

  const requests: HttpRequest[] = [];
  for (let i = 0; i < 4; i++) {
    requests.push(
      await httpRequestFlow.create(
        collection,
        new HttpRequest({ name: faker.string.alpha(10), url: `${HTTP_SERVER}/${faker.string.alphanumeric(10)}`, method: HttpMethod.Get }),
      ),
    );
  }
  await gitSyncFlow.commit(faker.string.alphanumeric(10));
  const [first, second, third, fourth] = requests;
  for (const request of requests) {
    await httpRequestFlow.get(request);
    await httpRequestPage.setUrl(`${HTTP_SERVER}/${faker.string.alphanumeric(10)}`);
  }

  await expect.poll(async () => gitSyncPage.hasUncommittedChanges(), { timeout: DEFAULT_TIMEOUT }).toBe(true);

  await gitSyncFlow.openVisualDiff(GitChangeList.Unstaged, fileName);
  await gitSyncPage.stageEntitiesInQuickSuccession([first.name, second.name, third.name]);
  const unstagedAfterBurst = await gitSyncPage.getEntityCardNames();
  await gitSyncFlow.openVisualDiff(GitChangeList.Staged, fileName);
  const stagedAfterBurst = await gitSyncPage.getEntityCardNames();
  await gitSyncFlow.stageEntity(fileName, second.name);
  await gitSyncFlow.stageEntity(fileName, third.name);
  await gitSyncFlow.openVisualDiff(GitChangeList.Staged, fileName);
  const stagedAtEnd = await gitSyncPage.getEntityCardNames();
  await gitSyncFlow.openVisualDiff(GitChangeList.Unstaged, fileName);
  const unstagedAtEnd = await gitSyncPage.getEntityCardNames();

  expect(unstagedAfterBurst.sort()).toEqual([second.name, third.name, fourth.name].sort());
  expect(stagedAfterBurst).toEqual([first.name]);
  expect(stagedAtEnd.sort()).toEqual([first.name, second.name, third.name].sort());
  expect(unstagedAtEnd).toEqual([fourth.name]);
});
