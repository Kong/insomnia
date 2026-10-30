import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { faker } from '@faker-js/faker';
import { expect } from "@playwright/test";

import { GitChangeList } from '../../../enums/git-change-list';
import { ProjectType } from '../../../enums/project-types';
import { DEFAULT_TIMEOUT, GIT_CREDENTIAL, pushServerFile, test } from "../../../misc/git-fixtures";
import { Project } from '../../../models/project';
import { planEntityTypeFiles } from './helpers';

test('Verify every entity type renders its own card and supports stage, unstage and discard, and partially staging a new mock file keeps its Mock Server URL in the staged content', async ({ user }) => {
  const { gitSyncFlow, preferencesFlow, workspaceFlow } = user.flowManager;
  const { gitSyncPage } = user.pageManager;

  const { names, build } = planEntityTypeFiles();
  const files = {
    collection: `${faker.string.alpha(8).toLowerCase()}.yaml`,
    mock: `${faker.string.alpha(9).toLowerCase()}.yaml`,
    mcp: `${faker.string.alpha(10).toLowerCase()}.yaml`,
  };
  const original = build(false);
  const seedFiles: Record<string, string> = {
    [files.collection]: original.collection,
    [files.mock]: original.mock,
    [files.mcp]: original.mcp,
  };
  for (const [filePath, content] of Object.entries(seedFiles)) {
    await pushServerFile({ path: filePath, content });
  }
  await preferencesFlow.addGitCredential(GIT_CREDENTIAL);
  const cloneParentDir = fs.mkdtempSync(path.join(os.tmpdir(), 'insomnia-visual-diff-'));
  await workspaceFlow.cloneGitProject(new Project(faker.string.alphanumeric(10), ProjectType.Git), GIT_CREDENTIAL.name, { cloneParentDir });
  const cloneDir = path.join(cloneParentDir, fs.readdirSync(cloneParentDir)[0]);
  const changed = build(true);
  // A second plan has its own ids, so its mock file is a new file next to the three modified ones
  const newMock = planEntityTypeFiles();
  const newMockFile = `${faker.string.alpha(11).toLowerCase()}.yaml`;
  fs.writeFileSync(path.join(cloneDir, files.collection), changed.collection);
  fs.writeFileSync(path.join(cloneDir, files.mock), changed.mock);
  fs.writeFileSync(path.join(cloneDir, files.mcp), changed.mcp);
  fs.writeFileSync(path.join(cloneDir, newMockFile), newMock.build(true).mock);
  await expect
    .poll(async () => (await gitSyncFlow.getChanges()).unstaged.length, { timeout: DEFAULT_TIMEOUT })
    .toBe(4);

  const entitiesByFile = [
    { file: files.collection, entities: [names.folder, names.request, names.webSocket, names.socketIo, names.grpc, 'Base Environment', 'Default Jar'] },
    { file: files.mock, entities: [names.mockRoute] },
    { file: files.mcp, entities: [names.mcp] },
  ];
  const tabsByEntity: Record<string, string[]> = {};
  for (const { file, entities } of entitiesByFile) {
    await gitSyncFlow.openVisualDiff(GitChangeList.Unstaged, file);
    for (const entity of entities) {
      tabsByEntity[entity] = await gitSyncPage.getEntityCardTabs(entity);
    }
  }
  for (const { file, entities } of entitiesByFile) {
    for (const entity of entities) {
      await gitSyncFlow.stageEntity(file, entity);
      await gitSyncFlow.unstageEntity(file, entity);
      await gitSyncFlow.discardEntity(file, entity);
    }
  }
  await expect.poll(async () => gitSyncPage.getUnstagedChanges(), { timeout: DEFAULT_TIMEOUT }).toEqual([newMockFile]);
  await gitSyncFlow.stageEntity(newMockFile, 'https://mock.example.com');
  const stagedWithServerOnly = execSync(`git show :${newMockFile}`, { cwd: cloneDir, encoding: 'utf8' });
  await gitSyncFlow.stageEntity(newMockFile, newMock.names.mockRoute);
  const stagedWithServerAndRoute = execSync(`git show :${newMockFile}`, { cwd: cloneDir, encoding: 'utf8' });
  await gitSyncPage.closeCommitDialog();

  expect(tabsByEntity).toEqual({
    [names.folder]: ['Headers 1'],
    [names.request]: ['Headers 1'],
    [names.webSocket]: ['Headers 1'],
    [names.socketIo]: ['Headers 1'],
    [names.grpc]: ['Headers 1'],
    'Base Environment': ['Variables 1'],
    'Default Jar': ['Cookies 1'],
    [names.mockRoute]: ['Headers 1'],
    [names.mcp]: ['Headers 1'],
  });
  expect(stagedWithServerOnly).toContain('https://mock.example.com');
  expect(stagedWithServerOnly).not.toContain(newMock.names.mockRoute);
  expect(stagedWithServerAndRoute).toContain('https://mock.example.com');
  expect(stagedWithServerAndRoute).toContain(newMock.names.mockRoute);
});
