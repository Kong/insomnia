import * as fs from 'node:fs';
import path from 'node:path';

import { faker } from '@faker-js/faker';
import { ProjectType } from '@package/enums/project-types';
import { DEFAULT_TIMEOUT } from '@package/misc/constants';
import { commitLocalFiles, GIT_CREDENTIAL, pushServerFile, test } from '@package/misc/git-fixtures';
import { Collection } from '@package/models/collection';
import { Project } from '@package/models/project';
import { expect } from '@playwright/test';

test('Verify a delete/modify conflict on an Insomnia file with a hand-written comment on its first line still opens the Resolve conflicts modal', async ({ user }) => {
  test.fail(true, 'INS-4332');

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

  const original = fs.readFileSync(path.join(repoPath, filePath), 'utf8');
  commitLocalFiles(repoPath, [{ path: filePath, content: `# ${faker.string.alpha(10)}\n${original}` }], faker.string.alphanumeric(10));
  await pushServerFile({ path: filePath, delete: true, message: faker.string.alphanumeric(10) });

  const conflicted = await gitSyncFlow.pullExpectingConflicts();
  await gitSyncFlow.resolvePullConflicts('Current');
  const pullIssues = await gitSyncFlow.getPullIssues();

  expect(conflicted).toEqual([collection.name]);
  expect(pullIssues.conflictModalOpen).toBe(false);
  await expect
    .poll(() => (fs.existsSync(path.join(repoPath, filePath)) ? fs.readFileSync(path.join(repoPath, filePath), 'utf8') : undefined), { timeout: DEFAULT_TIMEOUT })
    .toContain(collection.name);
});
