import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { faker } from '@faker-js/faker';
import { expect } from "@playwright/test";

import { GitChangeList } from '../../../enums/git-change-list';
import { ProjectType } from '../../../enums/project-types';
import { DEFAULT_TIMEOUT, GIT_CREDENTIAL, pushServerFile, test } from "../../../misc/git-fixtures";
import { Project } from '../../../models/project';
import { planFileLevelSettings } from './helpers';

test('Verify file-level settings appear in the Visual view and can be staged, unstaged and discarded on their own', async ({ user }) => {
  const { gitSyncFlow, preferencesFlow, workspaceFlow } = user.flowManager;
  const { gitSyncPage } = user.pageManager;

  const { names, build } = planFileLevelSettings();
  const specFile = `${faker.string.alpha(8).toLowerCase()}.yaml`;
  const mockFile = `${faker.string.alpha(9).toLowerCase()}.yaml`;
  const original = build(false);
  const seedFiles: Record<string, string> = { [specFile]: original.spec, [mockFile]: original.mock };
  for (const [filePath, content] of Object.entries(seedFiles)) {
    await pushServerFile({ path: filePath, content });
  }
  await preferencesFlow.addGitCredential(GIT_CREDENTIAL);
  const cloneParentDir = fs.mkdtempSync(path.join(os.tmpdir(), 'insomnia-visual-diff-'));
  await workspaceFlow.cloneGitProject(new Project(faker.string.alphanumeric(10), ProjectType.Git), GIT_CREDENTIAL.name, { cloneParentDir });
  const cloneDir = path.join(cloneParentDir, fs.readdirSync(cloneParentDir)[0]);
  const changed = build(true);
  fs.writeFileSync(path.join(cloneDir, specFile), changed.spec);
  fs.writeFileSync(path.join(cloneDir, mockFile), changed.mock);
  await expect
    .poll(async () => (await gitSyncFlow.getChanges()).unstaged.length, { timeout: DEFAULT_TIMEOUT })
    .toBe(2);

  await gitSyncFlow.openVisualDiff(GitChangeList.Unstaged, specFile);
  const specCards = await gitSyncPage.getEntityCardNames();
  await gitSyncFlow.openVisualDiff(GitChangeList.Unstaged, mockFile);
  const mockCards = await gitSyncPage.getEntityCardNames();
  const settings = [
    { file: specFile, name: names.workspace, stagedName: names.previousWorkspace, label: 'API Spec' },
    { file: specFile, name: names.workspace, stagedName: names.previousWorkspace, label: 'Unit Tests' },
    { file: specFile, name: names.workspace, stagedName: names.previousWorkspace, label: 'CA Certificates' },
    { file: mockFile, name: names.mockServerUrl, stagedName: names.mockServerUrl, label: 'Mock Server' },
    { file: specFile, name: names.workspace, stagedName: names.workspace, label: 'Workspace' },
  ];
  for (const { file, name, stagedName, label } of settings) {
    await gitSyncFlow.stageEntity(file, name, label);
    await gitSyncFlow.unstageEntity(file, stagedName, label);
    await gitSyncFlow.discardEntity(file, name, label);
  }
  await gitSyncPage.closeCommitDialog();

  expect(specCards).toEqual([names.workspace, names.workspace, names.workspace, names.workspace]);
  expect(mockCards).toEqual([names.mockServerUrl]);
  await expect.poll(async () => gitSyncPage.hasUncommittedChanges(), { timeout: DEFAULT_TIMEOUT }).toBe(false);
});
