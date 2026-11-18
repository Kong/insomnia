import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { faker } from '@faker-js/faker';
import { HttpMethod } from '@package/enums/http-method';
import { ProjectType } from '@package/enums/project-types';
import { HTTP_SERVER } from '@package/misc/fixtures';
import { DEFAULT_TIMEOUT, GIT_CREDENTIAL, pushServerFile, test } from "@package/misc/git-fixtures";
import { HttpRequest } from '@package/models/http-request';
import { Project } from '@package/models/project';
import { buildReorderedCollectionFile } from '@package/tests/git-sync/undiscardable-change/helpers';
import { expect } from "@playwright/test";

test('Verify staging one request in a file whose HEAD is not canonical only stages that request', async ({ user }) => {
  test.fail(true, "INS-4078");

  const { gitSyncFlow, httpRequestFlow, preferencesFlow, workspaceFlow } = user.flowManager;
  const { gitSyncPage, httpRequestPage } = user.pageManager;

  const fileName = `${faker.string.alpha(10).toLowerCase()}.yaml`;
  const { content, requestName } = buildReorderedCollectionFile(faker.string.alpha(10));
  const seedFiles: Record<string, string> = { [fileName]: content };
  for (const [filePath, content] of Object.entries(seedFiles)) {
    await pushServerFile({ path: filePath, content });
  }
  await preferencesFlow.addGitCredential(GIT_CREDENTIAL);
  const cloneParentDir = fs.mkdtempSync(path.join(os.tmpdir(), 'insomnia-visual-diff-'));
  await workspaceFlow.cloneGitProject(new Project(faker.string.alphanumeric(10), ProjectType.Git), GIT_CREDENTIAL.name, { cloneParentDir });
  const cloneDir = path.join(cloneParentDir, fs.readdirSync(cloneParentDir)[0]);
  const editedUrl = `${HTTP_SERVER}/${faker.string.alphanumeric(10)}`;
  await httpRequestFlow.get(new HttpRequest({ name: requestName, url: '', method: HttpMethod.Get }));
  await httpRequestPage.setUrl(editedUrl);
  await expect.poll(async () => gitSyncPage.hasUncommittedChanges(), { timeout: DEFAULT_TIMEOUT }).toBe(true);

  await gitSyncFlow.stageEntity(fileName, requestName);
  const stagedDiff = execSync(`git diff --cached -U0 -- ${fileName}`, { cwd: cloneDir, encoding: 'utf8' });
  const stagedLines = stagedDiff.split('\n').filter(line => /^[+-]/.test(line) && !/^(\+\+\+|---)/.test(line));

  expect(stagedLines.some(line => line.includes(editedUrl))).toBe(true);
  expect(stagedLines.length).toBeLessThanOrEqual(4);
});
