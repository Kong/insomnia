import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { faker } from '@faker-js/faker';
import { expect } from "@playwright/test";

import { GitChangeList } from '../../../enums/git-change-list';
import { ProjectType } from '../../../enums/project-types';
import { DEFAULT_TIMEOUT, GIT_CREDENTIAL, pushServerFile, test } from "../../../misc/git-fixtures";
import { Collection } from '../../../models/collection';
import { Project } from '../../../models/project';
import { buildCollectionFileWithUnknownField } from './helpers';

test('Verify editing a file again after staging it keeps it in both lists, shows no undiscardable warning and still asks for the unknown fields confirmation on commit', async ({
  user,
}) => {
  const { gitSyncFlow, httpRequestFlow, preferencesFlow, workspaceFlow } = user.flowManager;
  const { gitSyncPage } = user.pageManager;

  const fileName = `${faker.string.alpha(10).toLowerCase()}.yaml`;
  const collectionName = faker.string.alpha(10);
  const { content, requestName } = buildCollectionFileWithUnknownField(collectionName);
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

  const commitCountBefore = Number(execSync('git rev-list --count HEAD', { cwd: cloneDir, encoding: 'utf8' }));
  await gitSyncFlow.stageChanges([fileName]);
  const request = await httpRequestFlow.get(requestName, new Collection(collectionName));
  await workspaceFlow.renameRequest(request!, faker.string.alphanumeric(10));
  await expect
    .poll(async () => (await gitSyncFlow.getChanges()).unstaged, { timeout: DEFAULT_TIMEOUT })
    .toContain(fileName);

  const message = faker.lorem.sentence();
  await gitSyncPage.openCommitDialog();
  const stagedChanges = await gitSyncPage.getStagedChanges();
  const unstagedChanges = await gitSyncPage.getUnstagedChanges();
  await gitSyncPage.openChangeDiff(GitChangeList.Unstaged, fileName);
  const hasUnstagedUndiscardableWarning = await gitSyncPage.isUndiscardableWarningVisible();
  await gitSyncPage.commitStaged(message);
  const confirmationText = await gitSyncPage.getUnknownFieldsConfirmationText();
  await gitSyncPage.cancelUnknownFieldsConfirmation();
  const stagedAfterCancel = await gitSyncPage.getStagedChanges();
  const commitCountAfterCancel = Number(execSync('git rev-list --count HEAD', { cwd: cloneDir, encoding: 'utf8' }));
  await gitSyncPage.commitStaged(message);
  await gitSyncPage.confirmUnknownFieldsCommit();
  await gitSyncPage.waitForCommitToFinish();
  const commitCountAfterConfirm = Number(execSync('git rev-list --count HEAD', { cwd: cloneDir, encoding: 'utf8' }));

  expect(stagedChanges).toContain(fileName);
  expect(unstagedChanges).toContain(fileName);
  expect(hasUnstagedUndiscardableWarning).toBe(false);
  expect(confirmationText).toContain('Unrecognized Fields');
  expect(stagedAfterCancel).toContain(fileName);
  expect(commitCountAfterCancel).toBe(commitCountBefore);
  expect(commitCountAfterConfirm).toBe(commitCountBefore + 1);
});
