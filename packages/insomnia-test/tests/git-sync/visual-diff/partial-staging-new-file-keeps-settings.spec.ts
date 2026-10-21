import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { faker } from '@faker-js/faker';

import { ProjectType } from '../../../enums/project-types';
import { DEFAULT_TIMEOUT, expect, GIT_CREDENTIAL, pushServerFile,test } from '../../../misc/git-fixtures';
import { Project } from '../../../models/project';
import { planEntityTypeFiles } from './helpers';

test('Verify partially staging a new mock file keeps its Mock Server URL in the staged content', async ({ user }) => {
  const { gitSyncFlow, preferencesFlow, workspaceFlow } = user.flowManager;
  const { gitSyncPage } = user.pageManager;

  const { names, build } = planEntityTypeFiles();
  const existingFile = `${faker.string.alpha(8).toLowerCase()}.yaml`;
  const newFile = `${faker.string.alpha(9).toLowerCase()}.yaml`;
  const seedFiles: Record<string, string> = { [existingFile]: build(false).mcp };
  for (const [filePath, content] of Object.entries(seedFiles)) {
    await pushServerFile({ path: filePath, content });
  }
  await preferencesFlow.addGitCredential(GIT_CREDENTIAL);
  const cloneParentDir = fs.mkdtempSync(path.join(os.tmpdir(), 'insomnia-visual-diff-'));
  await workspaceFlow.create(new Project(faker.string.alphanumeric(10), ProjectType.Git), GIT_CREDENTIAL.name, { cloneParentDir });
  const cloneDir = path.join(cloneParentDir, fs.readdirSync(cloneParentDir)[0]);
  fs.writeFileSync(path.join(cloneDir, newFile), build(true).mock);
  await expect.poll(async () => gitSyncPage.hasUncommittedChanges(), { timeout: DEFAULT_TIMEOUT }).toBe(true);

  await gitSyncFlow.stageEntity(newFile, 'https://mock.example.com');
  const stagedWithServerOnly = execSync(`git show :${newFile}`, { cwd: cloneDir, encoding: 'utf8' });
  await gitSyncFlow.stageEntity(newFile, names.mockRoute);
  const stagedWithServerAndRoute = execSync(`git show :${newFile}`, { cwd: cloneDir, encoding: 'utf8' });

  expect(stagedWithServerOnly).toContain('https://mock.example.com');
  expect(stagedWithServerOnly).not.toContain(names.mockRoute);
  expect(stagedWithServerAndRoute).toContain('https://mock.example.com');
  expect(stagedWithServerAndRoute).toContain(names.mockRoute);
});
