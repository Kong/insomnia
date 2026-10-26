import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { faker } from '@faker-js/faker';

import { GitChangeList } from '../../../enums/git-change-list';
import { ProjectType } from '../../../enums/project-types';
import { DEFAULT_TIMEOUT, expect, GIT_CREDENTIAL, pushServerFile, test } from '../../../misc/git-fixtures';
import { Project } from '../../../models/project';
import { buildSeedCollectionFile, buildSeedFolder, buildSeedRequest, planMovedRequest, planSeedId, planSeedWorkspace } from './helpers';

test('Verify moved requests are never duplicated by stage, unstage or discard, discarding a new folder a request moved into brings the request back to its place, and a deleted folder is restored without its contents', async ({ user }) => {
  const { gitSyncFlow, preferencesFlow, workspaceFlow } = user.flowManager;
  const { gitSyncPage } = user.pageManager;

  const occurrences = (text: string, id: string) => text.split(id).length - 1;
  const readFile = (cloneDir: string, fileName: string) => fs.readFileSync(path.join(cloneDir, fileName), 'utf8');
  const readIndex = (cloneDir: string, fileName: string) => execSync(`git show :${fileName}`, { cwd: cloneDir, encoding: 'utf8' });
  const newFileName = () => `${faker.string.alpha(10).toLowerCase()}.yaml`;

  // A request that moved into an existing folder
  const moved = planMovedRequest();
  const movedFile = newFileName();
  // A request that moved into a folder created in the working tree
  const intoNewFolder = { workspace: planSeedWorkspace(), folder: { id: planSeedId('fld'), name: faker.string.alpha(10) }, request: { id: planSeedId('req'), name: faker.string.alpha(10) } };
  const intoNewFolderFile = newFileName();
  const intoNewFolderRequest = () => buildSeedRequest(intoNewFolder.request.id, intoNewFolder.request.name, 'https://example.com/moved');
  // A folder with two requests that was deleted in the working tree
  const deleted = {
    workspace: planSeedWorkspace(),
    folder: { id: planSeedId('fld'), name: faker.string.alpha(10) },
    children: [
      { id: planSeedId('req'), name: faker.string.alpha(10) },
      { id: planSeedId('req'), name: faker.string.alpha(10) },
    ],
  };
  const deletedFile = newFileName();
  const seedFiles: Record<string, string> = {
    [movedFile]: moved.build(false),
    [intoNewFolderFile]: buildSeedCollectionFile(intoNewFolder.workspace, [intoNewFolderRequest()]),
    [deletedFile]: buildSeedCollectionFile(deleted.workspace, [
      buildSeedFolder(
        deleted.folder.id,
        deleted.folder.name,
        deleted.children.map((child, index) => buildSeedRequest(child.id, child.name, `https://example.com/${index}`)),
      ),
    ]),
  };
  for (const [filePath, content] of Object.entries(seedFiles)) {
    await pushServerFile({ path: filePath, content });
  }
  await preferencesFlow.addGitCredential(GIT_CREDENTIAL);
  const cloneParentDir = fs.mkdtempSync(path.join(os.tmpdir(), 'insomnia-visual-diff-'));
  await workspaceFlow.create(new Project(faker.string.alphanumeric(10), ProjectType.Git), GIT_CREDENTIAL.name, { cloneParentDir });
  const cloneDir = path.join(cloneParentDir, fs.readdirSync(cloneParentDir)[0]);
  fs.writeFileSync(path.join(cloneDir, movedFile), moved.build(true));
  fs.writeFileSync(
    path.join(cloneDir, intoNewFolderFile),
    buildSeedCollectionFile(intoNewFolder.workspace, [buildSeedFolder(intoNewFolder.folder.id, intoNewFolder.folder.name, [intoNewFolderRequest()])]),
  );
  fs.writeFileSync(path.join(cloneDir, deletedFile), buildSeedCollectionFile(deleted.workspace, []));
  await expect
    .poll(async () => (await gitSyncFlow.getChanges()).unstaged.length, { timeout: DEFAULT_TIMEOUT })
    .toBe(3);

  // Moved into an existing folder
  await gitSyncFlow.stageEntity(movedFile, moved.requestName);
  const movedCopiesAfterStage = occurrences(readIndex(cloneDir, movedFile), moved.requestId);
  await gitSyncFlow.unstageEntity(movedFile, moved.requestName);
  const movedCopiesAfterUnstage = occurrences(readIndex(cloneDir, movedFile), moved.requestId);
  await gitSyncFlow.discardEntity(movedFile, moved.requestName);
  const movedCopiesAfterDiscard = occurrences(readFile(cloneDir, movedFile), moved.requestId);

  // Moved into a new folder
  await gitSyncFlow.openVisualDiff(GitChangeList.Unstaged, intoNewFolderFile);
  const intoNewFolderCardsBefore = await gitSyncPage.getEntityCardNames();
  await gitSyncFlow.stageEntity(intoNewFolderFile, intoNewFolder.folder.name);
  await gitSyncFlow.unstageEntity(intoNewFolderFile, intoNewFolder.folder.name);
  await gitSyncFlow.openVisualDiff(GitChangeList.Unstaged, intoNewFolderFile);
  await gitSyncPage.startEntityDiscard(intoNewFolder.folder.name);
  const intoNewFolderConfirmLabel = await gitSyncPage.getEntityDiscardConfirmLabel(intoNewFolder.folder.name);
  await gitSyncPage.confirmEntityDiscard(intoNewFolder.folder.name);
  const intoNewFolderCardsAfterFolderDiscard = await gitSyncPage.getEntityCardNames();
  const intoNewFolderRequestCardText = await gitSyncPage.getEntityCardText(intoNewFolder.request.name);
  await gitSyncFlow.discardEntity(intoNewFolderFile, intoNewFolder.request.name);
  const intoNewFolderRestored = readFile(cloneDir, intoNewFolderFile);

  // Deleted folder with contents
  const countDeleted = (text: string) => ({
    folders: occurrences(text, deleted.folder.id),
    requests: deleted.children.map(child => occurrences(text, child.id)),
  });
  await gitSyncFlow.stageEntity(deletedFile, deleted.folder.name);
  await gitSyncFlow.openVisualDiff(GitChangeList.Staged, deletedFile);
  const deletedStagedAfterStage = await gitSyncPage.getEntityCardNames();
  const deletedStagedStatuses = [
    await gitSyncPage.getEntityCardText(deleted.folder.name),
    await gitSyncPage.getEntityCardText(deleted.children[0].name),
    await gitSyncPage.getEntityCardText(deleted.children[1].name),
  ].map(text => text.includes('Removed'));
  await gitSyncFlow.unstageEntity(deletedFile, deleted.folder.name);
  const deletedStagedAfterUnstageFolder = await gitSyncPage.getEntityCardNames();
  const deletedIndexAfterUnstageFolder = countDeleted(readIndex(cloneDir, deletedFile));
  await gitSyncFlow.discardEntity(deletedFile, deleted.folder.name);
  const deletedFileAfterDiscardFolder = countDeleted(readFile(cloneDir, deletedFile));
  for (const child of deleted.children) {
    await gitSyncFlow.unstageEntity(deletedFile, child.name);
  }
  const deletedIndexAfterUnstageChildren = countDeleted(readIndex(cloneDir, deletedFile));
  for (const child of deleted.children) {
    await gitSyncFlow.discardEntity(deletedFile, child.name);
  }
  const deletedRestored = readFile(cloneDir, deletedFile);

  expect([movedCopiesAfterStage, movedCopiesAfterUnstage, movedCopiesAfterDiscard]).toEqual([1, 1, 1]);
  expect(intoNewFolderCardsBefore).toEqual([intoNewFolder.folder.name]);
  expect(intoNewFolderConfirmLabel).toBe('Confirm (discards its contents too)');
  expect(intoNewFolderCardsAfterFolderDiscard).toEqual([intoNewFolder.request.name]);
  expect(intoNewFolderRequestCardText).toContain('Removed');
  expect(occurrences(intoNewFolderRestored, intoNewFolder.request.id)).toBe(1);
  expect(occurrences(intoNewFolderRestored, intoNewFolder.folder.id)).toBe(0);
  expect(deletedStagedAfterStage.sort()).toEqual([deleted.folder.name, ...deleted.children.map(child => child.name)].sort());
  expect(deletedStagedStatuses).toEqual([true, true, true]);
  expect(deletedStagedAfterUnstageFolder.sort()).toEqual(deleted.children.map(child => child.name).sort());
  expect(deletedIndexAfterUnstageFolder).toEqual({ folders: 1, requests: [0, 0] });
  expect(deletedFileAfterDiscardFolder).toEqual({ folders: 1, requests: [0, 0] });
  expect(deletedIndexAfterUnstageChildren).toEqual({ folders: 1, requests: [1, 1] });
  expect(countDeleted(deletedRestored)).toEqual({ folders: 1, requests: [1, 1] });
  expect(deletedRestored.indexOf(deleted.folder.id)).toBeLessThan(deletedRestored.indexOf(deleted.children[0].id));
  expect(deletedRestored).toContain('children:');
});
