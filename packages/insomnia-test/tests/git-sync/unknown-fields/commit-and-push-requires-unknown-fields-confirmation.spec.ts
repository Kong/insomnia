import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { faker } from '@faker-js/faker';
import { expect } from "@playwright/test";

import { ProjectType } from '../../../enums/project-types';
import { DEFAULT_TIMEOUT, getServerCommits, GIT_CREDENTIAL, pushServerFile, test } from "../../../misc/git-fixtures";
import { Project } from '../../../models/project';
import { buildCollectionFileWithUnknownField } from './helpers';

test('Verify Commit and push on a staged file with unknown fields asks for confirmation, pushes nothing on Cancel and pushes a commit without the unknown field after Continue', async ({
  user,
}) => {
  const { gitSyncFlow, preferencesFlow, workspaceFlow } = user.flowManager;
  const { gitSyncPage } = user.pageManager;

  const fileName = `${faker.string.alpha(10).toLowerCase()}.yaml`;
  const { content, unknownField } = buildCollectionFileWithUnknownField(faker.string.alpha(10));
  await pushServerFile({ path: fileName, content });
  await preferencesFlow.addGitCredential(GIT_CREDENTIAL);
  const cloneParentDir = fs.mkdtempSync(path.join(os.tmpdir(), 'insomnia-unknown-fields-'));
  await workspaceFlow.cloneGitProject(new Project(faker.string.alphanumeric(10), ProjectType.Git), GIT_CREDENTIAL.name, {
    cloneParentDir,
  });
  const cloneDir = path.join(cloneParentDir, fs.readdirSync(cloneParentDir)[0]);
  await expect
    .poll(async () => (await gitSyncFlow.getChanges()).unstaged, { timeout: DEFAULT_TIMEOUT })
    .toContain(fileName);

  const localCommitCountBefore = Number(execSync('git rev-list --count HEAD', { cwd: cloneDir, encoding: 'utf8' }));
  const serverCommitsBefore = await getServerCommits();
  await gitSyncFlow.stageChanges([fileName]);
  const message = faker.lorem.sentence();
  await gitSyncPage.openCommitDialog();
  await gitSyncPage.commitStagedAndPush(message);
  const confirmationText = await gitSyncPage.getUnknownFieldsConfirmationText();
  await gitSyncPage.cancelUnknownFieldsConfirmation();
  const stagedAfterCancel = await gitSyncPage.getStagedChanges();
  const localCommitCountAfterCancel = Number(
    execSync('git rev-list --count HEAD', { cwd: cloneDir, encoding: 'utf8' }),
  );
  const serverCommitsAfterCancel = await getServerCommits();
  await gitSyncPage.commitStagedAndPush(message);
  await gitSyncPage.confirmUnknownFieldsCommit();
  await gitSyncPage.waitForCommitToFinish();
  await expect
    .poll(async () => (await getServerCommits()).length, { timeout: DEFAULT_TIMEOUT })
    .toBe(serverCommitsBefore.length + 1);
  const serverCommitsAfterConfirm = await getServerCommits();
  const localHeadId = execSync('git rev-parse HEAD', { cwd: cloneDir, encoding: 'utf8' }).trim();
  const localCommitCountAfterConfirm = Number(
    execSync('git rev-list --count HEAD', { cwd: cloneDir, encoding: 'utf8' }),
  );
  const committedFile = execSync(`git show HEAD:${fileName}`, { cwd: cloneDir, encoding: 'utf8' });
  const workingTreeStatus = execSync('git status --porcelain', { cwd: cloneDir, encoding: 'utf8' });
  const { unknownFieldFiles } = await workspaceFlow.cloneWithScanReport(
    new Project(faker.string.alphanumeric(10), ProjectType.Git),
    GIT_CREDENTIAL.name,
    { cloneParentDir: fs.mkdtempSync(path.join(os.tmpdir(), 'insomnia-unknown-fields-')) },
  );

  expect(confirmationText).toContain('Unrecognized Fields');
  expect(stagedAfterCancel).toEqual([fileName]);
  expect(localCommitCountAfterCancel).toBe(localCommitCountBefore);
  expect(serverCommitsAfterCancel).toEqual(serverCommitsBefore);
  expect(localCommitCountAfterConfirm).toBe(localCommitCountBefore + 1);
  expect(serverCommitsAfterConfirm[0]).toMatchObject({ id: localHeadId, message });
  expect(committedFile).not.toContain(unknownField);
  expect(workingTreeStatus).toBe('');
  expect(unknownFieldFiles).toEqual([]);
});
