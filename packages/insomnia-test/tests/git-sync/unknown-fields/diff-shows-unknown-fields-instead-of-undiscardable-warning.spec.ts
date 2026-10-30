import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { faker } from '@faker-js/faker';
import { expect } from "@playwright/test";

import { GitChangeList } from '../../../enums/git-change-list';
import { ProjectType } from '../../../enums/project-types';
import { DEFAULT_TIMEOUT, GIT_CREDENTIAL, pushServerFile, test } from "../../../misc/git-fixtures";
import { Project } from '../../../models/project';
import { buildCollectionFileWithUnknownField } from './helpers';

test('Verify cloning lists the file with unknown fields and the Commit Changes diff shows the unknown fields banner and highlight instead of the undiscardable warning', async ({
  user,
}) => {
  const { gitSyncFlow, preferencesFlow, workspaceFlow } = user.flowManager;
  const { gitSyncPage } = user.pageManager;

  const fileName = `${faker.string.alpha(10).toLowerCase()}.yaml`;
  const collectionName = faker.string.alpha(10);
  const { content, unknownField, unknownValue } = buildCollectionFileWithUnknownField(collectionName);
  await pushServerFile({ path: fileName, content });
  await preferencesFlow.addGitCredential(GIT_CREDENTIAL);
  const cloneParentDir = fs.mkdtempSync(path.join(os.tmpdir(), 'insomnia-unknown-fields-'));
  const projectName = faker.string.alphanumeric(10);
  const { unknownFieldFiles, unknownFieldsWarningText } = await workspaceFlow.cloneWithScanReport(
    new Project(projectName, ProjectType.Git),
    GIT_CREDENTIAL.name,
    { cloneParentDir },
  );
  const project = await workspaceFlow.getProject(projectName);
  const collection = await workspaceFlow.getCollection({ name: collectionName });
  const cloneDir = path.join(cloneParentDir, fs.readdirSync(cloneParentDir)[0]);
  await expect
    .poll(async () => (await gitSyncFlow.getChanges()).unstaged, { timeout: DEFAULT_TIMEOUT })
    .toContain(fileName);

  const gitDiff = execSync('git diff -U0', { cwd: cloneDir, encoding: 'utf8' });
  await gitSyncPage.openCommitDialog();
  await gitSyncPage.openChangeDiff(GitChangeList.Unstaged, fileName);
  const hasBanner = await gitSyncPage.isUnknownFieldsDiffWarningVisible();
  const bannerText = await gitSyncPage.getUnknownFieldsDiffWarningText();
  const highlightCount = await gitSyncPage.getUnknownFieldHighlightCount();
  const hasUndiscardableWarning = await gitSyncPage.isUndiscardableWarningVisible();

  expect(unknownFieldFiles).toEqual([fileName]);
  expect(unknownFieldsWarningText).toContain('Unknown Fields Detected');
  expect(project?.id).toBeTruthy();
  expect(collection).toBeDefined();
  expect(gitDiff).toContain(`-    ${unknownField}: ${unknownValue}`);
  expect(hasBanner).toBe(true);
  expect(bannerText).toContain('may break or remove functionality for your collaborators');
  expect(highlightCount).toBeGreaterThan(0);
  expect(hasUndiscardableWarning).toBe(false);
});
