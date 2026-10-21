import { faker } from '@faker-js/faker';

import { GitChangeList } from '../../../enums/git-change-list';
import { HttpMethod } from '../../../enums/http-method';
import { ProjectType } from '../../../enums/project-types';
import { HTTP_SERVER } from '../../../misc/fixtures';
import { DEFAULT_TIMEOUT, expect, GIT_CREDENTIAL,test } from '../../../misc/git-fixtures';
import { Collection } from '../../../models/collection';
import { HttpRequest } from '../../../models/http-request';
import { Project } from '../../../models/project';

test('Verify discarding every request of a new file removes the file from Unstaged without leaving an empty shell', async ({ user }) => {
  test.fail(true, "INS-4076");

  const { gitSyncFlow, httpRequestFlow, preferencesFlow, workspaceFlow } = user.flowManager;
  const { gitSyncPage } = user.pageManager;

  await preferencesFlow.addGitCredential(GIT_CREDENTIAL);
  const project = await workspaceFlow.create(new Project(faker.string.alphanumeric(10), ProjectType.Git), GIT_CREDENTIAL.name);
  const baseName = faker.string.alpha(10).toLowerCase();
  const collection = await workspaceFlow.create(project, new Collection(faker.string.alphanumeric(10)), baseName);
  const fileName = `${baseName}.yaml`;

  const requests: HttpRequest[] = [];
  for (let i = 0; i < 2; i++) {
    requests.push(
      await httpRequestFlow.create(
        collection,
        new HttpRequest({ name: faker.string.alpha(10), url: `${HTTP_SERVER}/${faker.string.alphanumeric(10)}`, method: HttpMethod.Get }),
      ),
    );
  }

  await expect.poll(async () => gitSyncPage.hasUncommittedChanges(), { timeout: DEFAULT_TIMEOUT }).toBe(true);

  await gitSyncFlow.openVisualDiff(GitChangeList.Unstaged, fileName);
  for (const request of requests) {
    await gitSyncFlow.discardEntity(fileName, request.name);
  }

  await expect.poll(async () => gitSyncPage.getUnstagedChanges(), { timeout: DEFAULT_TIMEOUT }).not.toContain(fileName);
});
