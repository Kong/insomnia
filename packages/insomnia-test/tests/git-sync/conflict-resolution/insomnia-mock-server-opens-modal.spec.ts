import * as fs from 'node:fs';
import path from 'node:path';

import { faker } from '@faker-js/faker';
import { ProjectType } from '@package/enums/project-types';
import { GIT_CREDENTIAL, pushServerFile, test } from '@package/misc/git-fixtures';
import { MockServer } from '@package/models/mock-server';
import { Project } from '@package/models/project';
import { expect } from '@playwright/test';

test('Verify a mock server Insomnia file conflict still opens the Resolve conflicts modal', async ({ user }) => {
  const { gitSyncFlow, mockServerFlow, preferencesFlow, workspaceFlow } = user.flowManager;

  await preferencesFlow.addGitCredential(GIT_CREDENTIAL);
  const project = await workspaceFlow.cloneGitProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Git),
    GIT_CREDENTIAL.name,
  );
  const repoPath = await workspaceFlow.getGitRepositoryPath(project);

  const filesBefore = new Set(fs.readdirSync(repoPath));
  const mockServer = await mockServerFlow.create(project, new MockServer(faker.string.alpha(10), 'https://example.com'));
  await gitSyncFlow.commitAndPush(faker.string.alphanumeric(10));
  const mockFile = fs.readdirSync(repoPath).find(file => file.endsWith('.yaml') && !filesBefore.has(file))!;
  const original = fs.readFileSync(path.join(repoPath, mockFile), 'utf8');
  const localName = faker.string.alpha(10);
  const remoteName = faker.string.alpha(10);
  await mockServerFlow.rename(mockServer, localName);
  await gitSyncFlow.commit(faker.string.alphanumeric(10));
  await pushServerFile({ path: mockFile, content: original.replace(`name: ${mockServer.name}`, `name: ${remoteName}`) });

  const conflicted = await gitSyncFlow.pullExpectingConflicts();
  await gitSyncFlow.resolvePullConflicts('Current');
  const pullIssues = await gitSyncFlow.getPullIssues();

  expect(original.split('\n')[0]).toBe('type: mock.insomnia.rest/5.0');
  expect(conflicted).toHaveLength(1);
  expect([localName, remoteName]).toContain(conflicted[0]);
  expect(pullIssues.conflictModalOpen).toBe(false);
});
