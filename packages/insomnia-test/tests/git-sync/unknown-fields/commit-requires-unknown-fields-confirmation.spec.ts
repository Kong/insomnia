import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { faker } from '@faker-js/faker';

import { GitChangeList } from '../../../enums/git-change-list';
import { ProjectType } from '../../../enums/project-types';
import { DEFAULT_TIMEOUT, expect, GIT_CREDENTIAL, pushServerFile, test } from '../../../misc/git-fixtures';
import { Project } from '../../../models/project';
import { UNDISCARDABLE_WARNING_TEXT } from '../undiscardable-change/helpers';
import { buildCollectionFileWithUnknownField } from './helpers';

test('Verify committing a staged file with unknown fields asks for confirmation, only commits after Continue and leaves a clean tree and a clone without the unknown field', async ({
  user,
}) => {
  const { gitSyncFlow, preferencesFlow, workspaceFlow } = user.flowManager;
  const { gitSyncPage } = user.pageManager;

  const fileName = `${faker.string.alpha(10).toLowerCase()}.yaml`;
  const { content, unknownField } = buildCollectionFileWithUnknownField(faker.string.alpha(10));
  await pushServerFile({ path: fileName, content });
  await preferencesFlow.addGitCredential(GIT_CREDENTIAL);
  const cloneParentDir = fs.mkdtempSync(path.join(os.tmpdir(), 'insomnia-unknown-fields-'));
  await workspaceFlow.create(new Project(faker.string.alphanumeric(10), ProjectType.Git), GIT_CREDENTIAL.name, {
    cloneParentDir,
  });
  const cloneDir = path.join(cloneParentDir, fs.readdirSync(cloneParentDir)[0]);
  await expect
    .poll(async () => (await gitSyncFlow.getChanges()).unstaged, { timeout: DEFAULT_TIMEOUT })
    .toContain(fileName);

  const commitCountBefore = Number(execSync('git rev-list --count HEAD', { cwd: cloneDir, encoding: 'utf8' }));
  await gitSyncFlow.stageChanges([fileName]);
  const message = faker.lorem.sentence();
  await gitSyncPage.openCommitDialog();
  await gitSyncPage.openChangeDiff(GitChangeList.Staged, fileName);
  const hasStagedUndiscardableWarning = await gitSyncPage.isUndiscardableWarningVisible();
  await gitSyncPage.commitStaged(message);
  const confirmationText = await gitSyncPage.getUnknownFieldsConfirmationText();
  await gitSyncPage.cancelUnknownFieldsConfirmation();
  const stagedAfterCancel = await gitSyncPage.getStagedChanges();
  const commitCountAfterCancel = Number(execSync('git rev-list --count HEAD', { cwd: cloneDir, encoding: 'utf8' }));
  await gitSyncPage.closeCommitDialog();
  const commit = await gitSyncFlow.commitStagedConfirmingUnknownFields(message);
  const commitCountAfterConfirm = Number(execSync('git rev-list --count HEAD', { cwd: cloneDir, encoding: 'utf8' }));
  await gitSyncFlow.push();
  const committedFile = execSync(`git show HEAD:${fileName}`, { cwd: cloneDir, encoding: 'utf8' });
  const workingTreeStatus = execSync('git status --porcelain', { cwd: cloneDir, encoding: 'utf8' });
  const { unknownFieldFiles } = await workspaceFlow.cloneWithScanReport(
    new Project(faker.string.alphanumeric(10), ProjectType.Git),
    GIT_CREDENTIAL.name,
    { cloneParentDir: fs.mkdtempSync(path.join(os.tmpdir(), 'insomnia-unknown-fields-')) },
  );

  expect(hasStagedUndiscardableWarning).toBe(false);
  expect(confirmationText).toContain('Unrecognized Fields');
  expect(confirmationText).not.toContain(UNDISCARDABLE_WARNING_TEXT);
  expect(stagedAfterCancel).toEqual([fileName]);
  expect(commitCountAfterCancel).toBe(commitCountBefore);
  expect(commit.message).toBe(message);
  expect(commitCountAfterConfirm).toBe(commitCountBefore + 1);
  expect(committedFile).not.toContain(unknownField);
  expect(workingTreeStatus).toBe('');
  expect(unknownFieldFiles).toEqual([]);
});
