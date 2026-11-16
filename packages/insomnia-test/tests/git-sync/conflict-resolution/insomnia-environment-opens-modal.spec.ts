import * as fs from 'node:fs';

import { faker } from '@faker-js/faker';
import { pushServerFile,test } from '@package/misc/git-fixtures';
import { expect } from '@playwright/test';

import { readRepoFile,setupGitProject } from './helpers';

test('Verify an environment Insomnia file conflict still opens the Resolve conflicts modal', async ({ user }) => {
  const { gitSyncFlow, workspaceFlow } = user.flowManager;
  const { project, repoPath } = await setupGitProject(user);

  const filesBefore = new Set(fs.readdirSync(repoPath));
  const environment = await workspaceFlow.createEnvironment(project, { name: faker.string.alpha(10) });
  await gitSyncFlow.commitAndPush(faker.string.alphanumeric(10));
  const envFile = fs.readdirSync(repoPath).find(file => file.endsWith('.yaml') && !filesBefore.has(file))!;
  const original = readRepoFile(repoPath, envFile)!;

  const localName = faker.string.alpha(10);
  const remoteName = faker.string.alpha(10);
  await workspaceFlow.renameEnvironment(environment, localName);
  await gitSyncFlow.commit(faker.string.alphanumeric(10));
  await pushServerFile({ path: envFile, content: original.replace(`name: ${environment.name}`, `name: ${remoteName}`) });

  const conflicted = await gitSyncFlow.pullExpectingConflicts();
  await gitSyncFlow.resolvePullConflicts('Current');
  const pullIssues = await gitSyncFlow.getPullIssues();

  expect(original.split('\n')[0]).toBe('type: environment.insomnia.rest/5.0');
  expect(conflicted).toHaveLength(1);
  expect([localName, remoteName]).toContain(conflicted[0]);
  expect(pullIssues.conflictModalOpen).toBe(false);
});
