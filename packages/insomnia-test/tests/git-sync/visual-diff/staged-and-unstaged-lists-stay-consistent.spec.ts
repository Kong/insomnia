import { faker } from '@faker-js/faker';

import { GitChangeList } from '../../../enums/git-change-list';
import { HttpMethod } from '../../../enums/http-method';
import { ProjectType } from '../../../enums/project-types';
import { HTTP_SERVER } from '../../../misc/fixtures';
import { DEFAULT_TIMEOUT, expect, GIT_CREDENTIAL,test } from '../../../misc/git-fixtures';
import { Collection } from '../../../models/collection';
import { HttpRequest } from '../../../models/http-request';
import { Project } from '../../../models/project';

test('Verify staging, unstaging and discarding entities keeps the Staged and Unstaged lists consistent', async ({ user }) => {
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
  const [entityA, entityB, entityC] = requests;
  for (const request of requests) {
    await httpRequestFlow.get(request);
    await httpRequestPage.setUrl(`${HTTP_SERVER}/${faker.string.alphanumeric(10)}`);
  }

  await expect.poll(async () => gitSyncPage.hasUncommittedChanges(), { timeout: DEFAULT_TIMEOUT }).toBe(true);

  await gitSyncFlow.stageEntity(fileName, entityA.name);
  await gitSyncFlow.stageEntity(fileName, entityB.name);
  const unstagedAfterStagingTwo = await gitSyncPage.getEntityCardNames();
  await gitSyncFlow.openVisualDiff(GitChangeList.Staged, fileName);
  const stagedAfterStagingTwo = await gitSyncPage.getEntityCardNames();
  await gitSyncFlow.unstageEntity(fileName, entityA.name);
  const stagedAfterUnstaging = await gitSyncPage.getEntityCardNames();
  await gitSyncFlow.discardEntity(fileName, entityC.name);
  const unstagedAfterDiscard = await gitSyncPage.getEntityCardNames();
  const filesBeforeLastStage = {
    staged: await gitSyncPage.getStagedChanges(),
    unstaged: await gitSyncPage.getUnstagedChanges(),
  };
  await gitSyncFlow.stageEntity(fileName, entityA.name);
  const filesAfterLastStage = {
    staged: await gitSyncPage.getStagedChanges(),
    unstaged: await gitSyncPage.getUnstagedChanges(),
  };

  expect(unstagedAfterStagingTwo).toEqual([entityC.name]);
  expect(stagedAfterStagingTwo.sort()).toEqual([entityA.name, entityB.name].sort());
  expect(stagedAfterUnstaging).toEqual([entityB.name]);
  expect(unstagedAfterDiscard).toEqual([entityA.name]);
  expect(filesBeforeLastStage).toEqual({ staged: [fileName], unstaged: [fileName] });
  expect(filesAfterLastStage).toEqual({ staged: [fileName], unstaged: [] });
});
