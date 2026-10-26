import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { faker } from '@faker-js/faker';

import { ProjectType } from '../../../enums/project-types';
import { MOCK_LLM_SERVER } from '../../../misc/fixtures';
import { DEFAULT_TIMEOUT, expect, GIT_CREDENTIAL, pushServerFile, test } from '../../../misc/git-fixtures';
import { Project } from '../../../models/project';
import { buildCollectionFileWithUnknownField } from './helpers';

test('Verify committing AI generated commits that include a file with unknown fields asks for confirmation, commits nothing on Cancel and commits without the unknown field after Continue', async ({
  user,
}) => {
  test.fail(true, 'INS-4134');

  const { gitSyncFlow, preferencesFlow, workspaceFlow } = user.flowManager;
  const { gitSyncPage } = user.pageManager;

  await preferencesFlow.set({
    aiUrlBackend: { url: MOCK_LLM_SERVER, model: 'mock-llm-model-1', apiKey: faker.string.alphanumeric(24) },
    aiSmartCommits: true,
  });
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
  await gitSyncPage.openCommitDialog();
  await gitSyncPage.generateCommits();
  await gitSyncPage.submitGeneratedCommits();
  const confirmationText = await gitSyncPage.getUnknownFieldsConfirmationText();
  await gitSyncPage.cancelUnknownFieldsConfirmation();
  const commitCountAfterCancel = Number(execSync('git rev-list --count HEAD', { cwd: cloneDir, encoding: 'utf8' }));
  await gitSyncPage.submitGeneratedCommits();
  await gitSyncPage.confirmUnknownFieldsCommit();
  await gitSyncPage.waitForCommitToFinish();
  await expect
    .poll(() => Number(execSync('git rev-list --count HEAD', { cwd: cloneDir, encoding: 'utf8' })), {
      timeout: DEFAULT_TIMEOUT,
    })
    .toBe(commitCountBefore + 1);
  const committedFile = execSync(`git show HEAD:${fileName}`, { cwd: cloneDir, encoding: 'utf8' });
  const committedSubject = execSync('git log -1 --format=%s', { cwd: cloneDir, encoding: 'utf8' }).trim();
  const workingTreeStatus = execSync('git status --porcelain', { cwd: cloneDir, encoding: 'utf8' });

  expect(confirmationText).toContain('Unrecognized Fields');
  expect(commitCountAfterCancel).toBe(commitCountBefore);
  expect(committedSubject).toContain(fileName);
  expect(committedFile).not.toContain(unknownField);
  expect(workingTreeStatus).toBe('');
});
