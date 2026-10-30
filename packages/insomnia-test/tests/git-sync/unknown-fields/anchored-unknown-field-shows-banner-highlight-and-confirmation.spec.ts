import { faker } from '@faker-js/faker';
import { expect } from "@playwright/test";

import { GitChangeList } from '../../../enums/git-change-list';
import { ProjectType } from '../../../enums/project-types';
import { DEFAULT_TIMEOUT, GIT_CREDENTIAL, pushServerFile, test } from "../../../misc/git-fixtures";
import { Project } from '../../../models/project';
import { buildCollectionFileWithUnknownField } from './helpers';

test('Verify an unknown field defined with a YAML anchor and alias is listed on Create Project, shows the banner and highlight, and asks for confirmation on commit', async ({
  user,
}) => {
  const { gitSyncFlow, preferencesFlow, workspaceFlow } = user.flowManager;
  const { gitSyncPage } = user.pageManager;

  const fileName = `${faker.string.alpha(10).toLowerCase()}.yaml`;
  const { content } = buildCollectionFileWithUnknownField(faker.string.alpha(10), { anchoredUnknownField: true });
  await pushServerFile({ path: fileName, content });
  await preferencesFlow.addGitCredential(GIT_CREDENTIAL);
  const { unknownFieldFiles } = await workspaceFlow.cloneWithScanReport(
    new Project(faker.string.alphanumeric(10), ProjectType.Git),
    GIT_CREDENTIAL.name,
  );
  await expect
    .poll(async () => (await gitSyncFlow.getChanges()).unstaged, { timeout: DEFAULT_TIMEOUT })
    .toContain(fileName);

  await gitSyncFlow.stageChanges([fileName]);
  await gitSyncPage.openCommitDialog();
  await gitSyncPage.openChangeDiff(GitChangeList.Staged, fileName);
  const hasBanner = await gitSyncPage.isUnknownFieldsDiffWarningVisible();
  const highlightCount = await gitSyncPage.getUnknownFieldHighlightCount();
  await gitSyncPage.commitStaged(faker.lorem.sentence());
  const confirmationText = await gitSyncPage.getUnknownFieldsConfirmationText();

  expect(unknownFieldFiles).toEqual([fileName]);
  expect(hasBanner).toBe(true);
  expect(highlightCount).toBeGreaterThan(0);
  expect(confirmationText).toContain('Unrecognized Fields');
});
