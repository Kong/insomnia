import { faker } from '@faker-js/faker';

import { HttpMethod } from '../../enums/http-method';
import { ProjectType } from '../../enums/project-types';
import { HTTP_SERVER } from '../../misc/fixtures';
import { expect, getServerCommits, GIT_CREDENTIAL, test } from '../../misc/git-fixtures';
import { Collection } from '../../models/collection';
import { Project } from '../../models/project';

test('Verify committing a new collection and then a new request in a Git Sync project appears in History', async ({
  user,
}) => {
  const { gitSyncFlow, httpRequestFlow, preferencesFlow, workspaceFlow } = user.flowManager;

  await preferencesFlow.addGitCredential(GIT_CREDENTIAL);
  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Git),
    GIT_CREDENTIAL.name,
  );
  const collection = await workspaceFlow.create(
    project,
    new Collection(faker.string.alphanumeric(10)),
    faker.string.alphanumeric(10),
  );

  const message = faker.string.alphanumeric(10);
  const commit = await gitSyncFlow.commit(message);

  await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Get,
    url: `${HTTP_SERVER}/cookies`,
  });
  const secondMessage = faker.string.alphanumeric(10);
  const secondCommit = await gitSyncFlow.commit(secondMessage);
  const serverCommits = await getServerCommits();

  expect(commit.message).toEqual(message);
  expect(commit.id).toBeDefined();
  expect(secondCommit.message).toEqual(secondMessage);
  expect(secondCommit.id).toBeDefined();
  expect(secondCommit.id).not.toEqual(commit.id);
  expect(serverCommits.some(c => c.id === commit.id || c.id === secondCommit.id)).toBe(false);
});
