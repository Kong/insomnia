import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { faker } from '@faker-js/faker';
import { expect } from "@playwright/test";

import { ProjectType } from '../../../enums/project-types';
import { DEFAULT_TIMEOUT, GIT_CREDENTIAL, pushServerFile, test } from "../../../misc/git-fixtures";
import { Project } from '../../../models/project';
import { UNDISCARDABLE_WARNING_TEXT } from '../undiscardable-change/helpers';
import { buildCollectionFileWithUnknownField } from './helpers';

test('Verify cancelling the unknown fields confirmation after accepting the stage all prompt leaves nothing staged and creates no commit', async ({
  user,
}) => {
  const { gitSyncFlow, preferencesFlow, workspaceFlow } = user.flowManager;
  const { gitSyncPage } = user.pageManager;

  const fileName = `${faker.string.alpha(10).toLowerCase()}.yaml`;
  const { content } = buildCollectionFileWithUnknownField(faker.string.alpha(10));
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
  await gitSyncPage.openCommitDialog();
  await gitSyncPage.commitStaged(faker.lorem.sentence());
  const stageAllPromptText = await gitSyncPage.getStageAllPromptText();
  await gitSyncPage.acceptStageAllPrompt();
  const confirmationText = await gitSyncPage.getUnknownFieldsConfirmationText();
  await gitSyncPage.cancelUnknownFieldsConfirmation();
  const stagedAfterCancel = await gitSyncPage.getStagedChanges();
  const unstagedAfterCancel = await gitSyncPage.getUnstagedChanges();
  const commitCountAfterCancel = Number(execSync('git rev-list --count HEAD', { cwd: cloneDir, encoding: 'utf8' }));

  expect(stageAllPromptText).toContain('There are no staged changes to commit');
  expect(confirmationText).toContain('Unrecognized Fields');
  expect(confirmationText).not.toContain(UNDISCARDABLE_WARNING_TEXT);
  expect(stagedAfterCancel).toEqual([]);
  expect(unstagedAfterCancel).toEqual([fileName]);
  expect(commitCountAfterCancel).toBe(commitCountBefore);
});
