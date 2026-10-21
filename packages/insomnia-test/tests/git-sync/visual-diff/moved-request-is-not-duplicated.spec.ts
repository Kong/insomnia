import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { faker } from '@faker-js/faker';

import { ProjectType } from '../../../enums/project-types';
import { DEFAULT_TIMEOUT, expect, GIT_CREDENTIAL, pushServerFile,test } from '../../../misc/git-fixtures';
import { Project } from '../../../models/project';
import { planMovedRequest } from './helpers';

test('Verify staging or discarding a request that moved into a folder leaves exactly one copy of it', async ({ user }) => {
  const { gitSyncFlow, preferencesFlow, workspaceFlow } = user.flowManager;
  const { gitSyncPage } = user.pageManager;

  const { requestId, requestName, build } = planMovedRequest();
  const fileName = `${faker.string.alpha(10).toLowerCase()}.yaml`;
  const seedFiles: Record<string, string> = { [fileName]: build(false) };
  for (const [filePath, content] of Object.entries(seedFiles)) {
    await pushServerFile({ path: filePath, content });
  }
  await preferencesFlow.addGitCredential(GIT_CREDENTIAL);
  const cloneParentDir = fs.mkdtempSync(path.join(os.tmpdir(), 'insomnia-visual-diff-'));
  await workspaceFlow.create(new Project(faker.string.alphanumeric(10), ProjectType.Git), GIT_CREDENTIAL.name, { cloneParentDir });
  const cloneDir = path.join(cloneParentDir, fs.readdirSync(cloneParentDir)[0]);
  fs.writeFileSync(path.join(cloneDir, fileName), build(true));
  await expect.poll(async () => gitSyncPage.hasUncommittedChanges(), { timeout: DEFAULT_TIMEOUT }).toBe(true);

  await gitSyncFlow.stageEntity(fileName, requestName);
  const copiesInIndexAfterStage = execSync(`git show :${fileName}`, { cwd: cloneDir, encoding: 'utf8' }).split(requestId).length - 1;
  await gitSyncFlow.unstageEntity(fileName, requestName);
  const copiesInIndexAfterUnstage = execSync(`git show :${fileName}`, { cwd: cloneDir, encoding: 'utf8' }).split(requestId).length - 1;
  await gitSyncFlow.discardEntity(fileName, requestName);
  const copiesInFileAfterDiscard = fs.readFileSync(path.join(cloneDir, fileName), 'utf8').split(requestId).length - 1;

  expect(copiesInIndexAfterStage).toBe(1);
  expect(copiesInIndexAfterUnstage).toBe(1);
  expect(copiesInFileAfterDiscard).toBe(1);
});
