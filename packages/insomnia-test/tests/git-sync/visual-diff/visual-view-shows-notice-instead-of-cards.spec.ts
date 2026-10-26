import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { faker } from '@faker-js/faker';

import { GitChangeList } from '../../../enums/git-change-list';
import { GitDiffView } from '../../../enums/git-diff-view';
import { ProjectType } from '../../../enums/project-types';
import { buildCollectionFile, DEFAULT_TIMEOUT, expect, GIT_CREDENTIAL, pushServerFile, test } from '../../../misc/git-fixtures';
import { Project } from '../../../models/project';

test('Verify the Visual view shows a notice instead of cards for a conflicted file, a file that does not match the Insomnia file format and non-Insomnia files', async ({ user }) => {
  const { gitSyncFlow, preferencesFlow, workspaceFlow } = user.flowManager;
  const { gitSyncPage } = user.pageManager;

  const conflictFile = `${faker.string.alpha(10).toLowerCase()}.yaml`;
  const spectralFile = '.spectral.yaml';
  const openApiFile = `${faker.string.alpha(11).toLowerCase()}.yaml`;
  const invalidFile = `${faker.string.alpha(12).toLowerCase()}.yaml`;
  const original = buildCollectionFile(faker.string.alpha(10));
  const seedFiles: Record<string, string> = {
    [conflictFile]: original,
    [spectralFile]: 'extends: spectral:oas\n',
    [invalidFile]: buildCollectionFile(faker.string.alpha(10)),
    [openApiFile]: `openapi: 3.0.0\ninfo:\n  title: ${faker.string.alpha(10)}\n`,
  };
  for (const [filePath, content] of Object.entries(seedFiles)) {
    await pushServerFile({ path: filePath, content });
  }
  await preferencesFlow.addGitCredential(GIT_CREDENTIAL);
  const cloneParentDir = fs.mkdtempSync(path.join(os.tmpdir(), 'insomnia-visual-diff-'));
  await workspaceFlow.create(new Project(faker.string.alphanumeric(10), ProjectType.Git), GIT_CREDENTIAL.name, { cloneParentDir });
  const cloneDir = path.join(cloneParentDir, fs.readdirSync(cloneParentDir)[0]);
  const conflicted = `${original}<<<<<<< HEAD\n  - url: https://ours.example.com\n=======\n  - url: https://theirs.example.com\n>>>>>>> main\n`;
  fs.writeFileSync(path.join(cloneDir, conflictFile), conflicted);
  fs.appendFileSync(path.join(cloneDir, spectralFile), 'rules: {}\n');
  fs.writeFileSync(path.join(cloneDir, invalidFile), fs.readFileSync(path.join(cloneDir, invalidFile), 'utf8').replace('collection: []', 'collection: not-a-list'));
  fs.appendFileSync(path.join(cloneDir, openApiFile), `  version: ${faker.string.numeric(3)}\n`);
  await expect
    .poll(async () => (await gitSyncFlow.getChanges()).unstaged.length, { timeout: DEFAULT_TIMEOUT })
    .toBe(4);

  await gitSyncFlow.openVisualDiff(GitChangeList.Unstaged, conflictFile);
  const conflictNotice = await gitSyncPage.getVisualDiffNotice();
  const conflictCards = await gitSyncPage.getEntityCardNames();
  await gitSyncPage.openTextViewFromNotice();
  const viewAfterConflictLink = await gitSyncPage.getDiffView();
  const conflictContent = fs.readFileSync(path.join(cloneDir, conflictFile), 'utf8');
  await gitSyncFlow.openVisualDiff(GitChangeList.Unstaged, spectralFile);
  const spectralNotice = await gitSyncPage.getVisualDiffNotice();
  const spectralCards = await gitSyncPage.getEntityCardNames();
  await gitSyncFlow.openVisualDiff(GitChangeList.Unstaged, invalidFile);
  const invalidNotice = await gitSyncPage.getVisualDiffNotice();
  const invalidCards = await gitSyncPage.getEntityCardNames();
  const invalidWarningAbsent = await gitSyncPage.isVisualDiffFormatWarningAbsent();
  await gitSyncFlow.openVisualDiff(GitChangeList.Unstaged, openApiFile);
  const openApiNotice = await gitSyncPage.getVisualDiffNotice();
  await gitSyncPage.openTextViewFromNotice();
  const viewAfterOpenApiLink = await gitSyncPage.getDiffView();

  expect(conflictNotice).toContain('Unable to parse this file for a visual diff.');
  expect(conflictCards).toEqual([]);
  expect(conflictContent).toBe(conflicted);
  for (const notice of [conflictNotice, spectralNotice, openApiNotice]) {
    expect(notice).toContain('Open the Text view');
  }
  for (const notice of [spectralNotice, openApiNotice]) {
    expect(notice).toContain('No requests, folders, environments or settings changed');
  }
  expect(invalidNotice).toContain("This file doesn't match the Insomnia file format");
  expect(invalidNotice).toContain('Open the Text view');
  expect(invalidCards).toEqual([]);
  expect(invalidWarningAbsent).toBe(true);
  expect(spectralCards).toEqual([]);
  expect([viewAfterConflictLink, viewAfterOpenApiLink]).toEqual([GitDiffView.Text, GitDiffView.Text]);
});
