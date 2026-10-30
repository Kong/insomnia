import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { faker } from '@faker-js/faker';
import { expect } from "@playwright/test";

import { GitChangeList } from '../../../enums/git-change-list';
import { GitDiffView } from '../../../enums/git-diff-view';
import { HttpMethod } from '../../../enums/http-method';
import { ProjectType } from '../../../enums/project-types';
import { HTTP_SERVER } from '../../../misc/fixtures';
import { DEFAULT_TIMEOUT, GIT_CREDENTIAL, pushServerFile, test } from "../../../misc/git-fixtures";
import { HttpRequest } from '../../../models/http-request';
import { Project } from '../../../models/project';
import { buildReorderedCollectionFile } from '../undiscardable-change/helpers';
import { buildCollectionFileWithUnknownField } from '../unknown-fields/helpers';

test('Verify a file whose committed version is not in the format Insomnia writes shows a warning above its cards, and a file with unrecognized fields shows only the unrecognized-fields warning', async ({ user }) => {
  const { gitSyncFlow, httpRequestFlow, preferencesFlow, workspaceFlow } = user.flowManager;
  const { gitSyncPage, httpRequestPage } = user.pageManager;

  const reorderedFile = `${faker.string.alpha(10).toLowerCase()}.yaml`;
  const reordered = buildReorderedCollectionFile(faker.string.alpha(10));
  const unknownFieldsFile = `${faker.string.alpha(11).toLowerCase()}.yaml`;
  const unknownFieldsRequestName = faker.string.alpha(10);
  const unknownFields = buildCollectionFileWithUnknownField(faker.string.alpha(10), { requestName: unknownFieldsRequestName });
  await pushServerFile({ path: reorderedFile, content: reordered.content });
  await pushServerFile({ path: unknownFieldsFile, content: unknownFields.content });
  await preferencesFlow.addGitCredential(GIT_CREDENTIAL);
  const cloneParentDir = fs.mkdtempSync(path.join(os.tmpdir(), 'insomnia-visual-diff-'));
  await workspaceFlow.cloneGitProject(new Project(faker.string.alphanumeric(10), ProjectType.Git), GIT_CREDENTIAL.name, { cloneParentDir });
  const cloneDir = path.join(cloneParentDir, fs.readdirSync(cloneParentDir)[0]);
  const editedUrl = `${HTTP_SERVER}/${faker.string.alphanumeric(10)}`;
  for (const requestName of [reordered.requestName, unknownFieldsRequestName]) {
    await httpRequestFlow.get(new HttpRequest({ name: requestName, url: '', method: HttpMethod.Get }));
    await httpRequestPage.setUrl(editedUrl);
  }
  await expect
    .poll(async () => (await gitSyncFlow.getChanges()).unstaged.length, { timeout: DEFAULT_TIMEOUT })
    .toBe(2);

  await gitSyncFlow.openVisualDiff(GitChangeList.Unstaged, reorderedFile);
  const reorderedCards = await gitSyncPage.getEntityCardNames();
  const reorderedWarning = await gitSyncPage.getVisualDiffFormatWarning();
  const reorderedStageEnabled = await gitSyncPage.isEntityStageEnabled(reordered.requestName);
  const reorderedHasUnknownFieldsBanner = await gitSyncPage.isUnknownFieldsDiffWarningVisible();
  await gitSyncPage.openTextViewFromWarning();
  const viewAfterWarningLink = await gitSyncPage.getDiffView();
  const workingFile = fs.readFileSync(path.join(cloneDir, reorderedFile), 'utf8');

  await gitSyncFlow.openVisualDiff(GitChangeList.Unstaged, unknownFieldsFile);
  const unknownFieldsCards = await gitSyncPage.getEntityCardNames();
  const unknownFieldsBanner = await gitSyncPage.isUnknownFieldsDiffWarningVisible();
  const unknownFieldsFormatWarningAbsent = await gitSyncPage.isVisualDiffFormatWarningAbsent();

  expect(reorderedCards).toContain(reordered.requestName);
  expect(reorderedWarning).toContain("This file isn't in the format Insomnia writes");
  expect(reorderedWarning).toContain('staging or discarding a card rewrites the whole file');
  expect(reorderedStageEnabled).toBe(true);
  expect(reorderedHasUnknownFieldsBanner).toBe(false);
  expect(viewAfterWarningLink).toBe(GitDiffView.Text);
  expect(workingFile).toContain(editedUrl);
  expect(unknownFieldsCards).toContain(unknownFieldsRequestName);
  expect(unknownFieldsBanner).toBe(true);
  expect(unknownFieldsFormatWarningAbsent).toBe(true);
});
