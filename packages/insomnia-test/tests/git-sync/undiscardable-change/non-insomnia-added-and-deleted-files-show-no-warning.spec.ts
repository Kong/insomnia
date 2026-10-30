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

test('Verify a modified non-Insomnia file and an added or deleted file show no undiscardable warning or unknown fields UI, and commit without confirmation', async ({
  user,
}) => {
  const { gitSyncFlow, preferencesFlow, workspaceFlow } = user.flowManager;
  const { gitSyncPage } = user.pageManager;

  const otherFileName = `${faker.string.alpha(10).toLowerCase()}.yaml`;
  await pushServerFile({ path: otherFileName, content: `openapi: 3.0.0\ninfo:\n  title: ${faker.string.alpha(10)}\n` });
  await preferencesFlow.addGitCredential(GIT_CREDENTIAL);
  const cloneParentDir = fs.mkdtempSync(path.join(os.tmpdir(), 'insomnia-undiscardable-'));
  const projectName = faker.string.alphanumeric(10);
  const { unknownFieldFiles } = await workspaceFlow.cloneWithScanReport(
    new Project(projectName, ProjectType.Git),
    GIT_CREDENTIAL.name,
    { cloneParentDir },
  );
  const project = (await workspaceFlow.getProject(projectName))!;
  const deletedFile = faker.string.alpha(10).toLowerCase();
  const deletedCollection = await workspaceFlow.createCollection(
    project,
    new Collection(faker.string.alphanumeric(10)),
    deletedFile,
  );
  await gitSyncFlow.commit(faker.string.alphanumeric(10));
  const cloneDir = path.join(cloneParentDir, fs.readdirSync(cloneParentDir)[0]);
  fs.appendFileSync(path.join(cloneDir, otherFileName), `  version: ${faker.string.numeric(3)}\n`);
  const addedFile = faker.string.alpha(11).toLowerCase();
  await workspaceFlow.createCollection(project, new Collection(faker.string.alphanumeric(10)), addedFile);
  await workspaceFlow.delete(deletedCollection);
  await expect
    .poll(async () => (await gitSyncFlow.getChanges()).unstaged.length, {
      timeout: DEFAULT_TIMEOUT,
    })
    .toBeGreaterThanOrEqual(3);
  const unstaged = (await gitSyncFlow.getChanges()).unstaged;
  const warnings = [];
  const unknownFieldsStates = [];
  for (const file of unstaged) {
    await gitSyncPage.openCommitDialog();
    await gitSyncPage.openChangeDiff(GitChangeList.Unstaged, file);
    warnings.push(await gitSyncPage.isUndiscardableWarningVisible());
    unknownFieldsStates.push({
      hasBanner: await gitSyncPage.isUnknownFieldsDiffWarningVisible(),
      highlightCount: await gitSyncPage.getUnknownFieldHighlightCount(),
    });
    await gitSyncPage.closeCommitDialog();
  }
  const message = faker.string.alphanumeric(10);
  const commit = await gitSyncFlow.commit(message);

  expect(unknownFieldFiles).toEqual([]);
  expect(unstaged).toEqual(
    expect.arrayContaining([
      expect.stringContaining(otherFileName),
      expect.stringContaining(addedFile),
      expect.stringContaining(deletedFile),
    ]),
  );
  expect(warnings).toEqual(unstaged.map(() => false));
  expect(unknownFieldsStates).toEqual(unstaged.map(() => ({ hasBanner: false, highlightCount: 0 })));
  expect(commit.message).toBe(message);
});
