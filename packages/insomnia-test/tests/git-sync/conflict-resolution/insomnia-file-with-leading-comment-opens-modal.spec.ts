import * as fs from 'node:fs';
import path from 'node:path';

import { faker } from '@faker-js/faker';
import { ProjectType } from '@package/enums/project-types';
import { DEFAULT_TIMEOUT } from '@package/misc/constants';
import { buildCollectionFile, commitLocalFiles, GIT_CREDENTIAL, pushServerFile, test } from '@package/misc/git-fixtures';
import { Collection } from '@package/models/collection';
import { Project } from '@package/models/project';
import { expect } from '@playwright/test';

test('Verify a conflict on an Insomnia file with a hand-written comment on its first line still opens the Resolve conflicts modal', async ({ user }) => {
  test.fail();

  const { gitSyncFlow, preferencesFlow, workspaceFlow } = user.flowManager;

  await preferencesFlow.addGitCredential(GIT_CREDENTIAL);

  const project = await workspaceFlow.cloneGitProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Git),
    GIT_CREDENTIAL.name,
  );
  const repoPath = await workspaceFlow.getGitRepositoryPath(project);
  const fileName = faker.string.alpha(10).toLowerCase();
  const filePath = `${fileName}.yaml`;
  const collection = await workspaceFlow.createCollection(
    project,
    new Collection(faker.string.alphanumeric(10)),
    fileName,
  );
  await gitSyncFlow.commitAndPush(faker.string.alphanumeric(10));

  const handWrittenComment = `# ${faker.string.alpha(10)}`;
  const original = fs.readFileSync(path.join(repoPath, filePath), 'utf8');
  commitLocalFiles(repoPath, [{ path: filePath, content: `${handWrittenComment}\n${original}` }], faker.string.alphanumeric(10));
  const remoteCollection = new Collection(faker.string.alpha(10));
  await pushServerFile({ path: filePath, content: buildCollectionFile(remoteCollection.name) });

  const conflicted = await gitSyncFlow.pullExpectingConflicts();
  await gitSyncFlow.resolvePullConflicts('Current');
  const pullIssues = await gitSyncFlow.getPullIssues();

  expect(conflicted).toHaveLength(1);
  expect([collection.name, remoteCollection.name]).toContain(conflicted[0]);
  expect(pullIssues.conflictModalOpen).toBe(false);
  await expect
    .poll(() => fs.readFileSync(path.join(repoPath, filePath), 'utf8'), { timeout: DEFAULT_TIMEOUT })
    .toContain(collection.name);
  expect(fs.readFileSync(path.join(repoPath, filePath), 'utf8')).not.toContain(remoteCollection.name);
});
