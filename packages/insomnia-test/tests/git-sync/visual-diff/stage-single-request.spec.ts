import { faker } from '@faker-js/faker';

import { GitChangeList } from '../../../enums/git-change-list';
import { HttpMethod } from '../../../enums/http-method';
import { ProjectType } from '../../../enums/project-types';
import { HTTP_SERVER } from '../../../misc/fixtures';
import { DEFAULT_TIMEOUT, expect, GIT_CREDENTIAL,test } from '../../../misc/git-fixtures';
import { Collection } from '../../../models/collection';
import { HttpRequest } from '../../../models/http-request';
import { Project } from '../../../models/project';

test('Verify staging one request from the Visual (Beta) view leaves the others unstaged and each side offers the right card actions', async ({ user }) => {
  const { gitSyncFlow, httpRequestFlow, preferencesFlow, workspaceFlow } = user.flowManager;
  const { gitSyncPage, httpRequestPage } = user.pageManager;

  await preferencesFlow.addGitCredential(GIT_CREDENTIAL);
  const project = await workspaceFlow.create(new Project(faker.string.alphanumeric(10), ProjectType.Git), GIT_CREDENTIAL.name);
  const baseName = faker.string.alpha(10).toLowerCase();
  const collection = await workspaceFlow.create(project, new Collection(faker.string.alphanumeric(10)), baseName);
  const fileName = `${baseName}.yaml`;

  const requests: HttpRequest[] = [];
  for (let i = 0; i < 3; i++) {
    requests.push(
      await httpRequestFlow.create(
        collection,
        new HttpRequest({ name: faker.string.alpha(10), url: `${HTTP_SERVER}/${faker.string.alphanumeric(10)}`, method: HttpMethod.Get }),
      ),
    );
  }
  await gitSyncFlow.commit(faker.string.alphanumeric(10));

  for (const request of requests) {
    await httpRequestFlow.get(request);
    await httpRequestPage.setUrl(`${HTTP_SERVER}/${faker.string.alphanumeric(10)}`);
  }

  await expect.poll(async () => gitSyncPage.hasUncommittedChanges(), { timeout: DEFAULT_TIMEOUT }).toBe(true);

  await gitSyncFlow.stageEntity(fileName, requests[0].name);
  const unstagedCards = await gitSyncPage.getEntityCardNames();
  const unstagedActions = await gitSyncPage.getEntityCardActions(requests[1].name);
  const unstagedFiles = await gitSyncPage.getUnstagedChanges();
  const stagedFiles = await gitSyncPage.getStagedChanges();
  await gitSyncFlow.openVisualDiff(GitChangeList.Staged, fileName);
  const stagedCards = await gitSyncPage.getEntityCardNames();
  const stagedActions = await gitSyncPage.getEntityCardActions(requests[0].name);

  expect(unstagedCards.sort()).toEqual([requests[1].name, requests[2].name].sort());
  expect(stagedFiles).toEqual([fileName]);
  expect(unstagedFiles).toEqual([fileName]);
  expect(stagedCards).toEqual([requests[0].name]);
  expect(unstagedActions).toEqual(['Discard', 'Stage']);
  expect(stagedActions).toEqual(['Unstage']);
});
