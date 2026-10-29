import { faker } from '@faker-js/faker';
import { expect } from "@playwright/test";

import { GitChangeList } from '../../../enums/git-change-list';
import { ProjectType } from '../../../enums/project-types';
import { DEFAULT_TIMEOUT, GIT_CREDENTIAL, pushServerFile, test } from "../../../misc/git-fixtures";
import { Project } from '../../../models/project';
import { buildCollectionFileWithUnknownField, type ExtraUnknownField } from './helpers';

test('Verify unknown fields nested deep in request settings, folder request meta, environment meta and the file root are listed on Create Project, show the banner and highlights, and ask for confirmation on commit', async ({
  user,
}) => {
  const { gitSyncFlow, preferencesFlow, workspaceFlow } = user.flowManager;
  const { gitSyncPage } = user.pageManager;

  const fileName = `${faker.string.alpha(10).toLowerCase()}.yaml`;
  const extraUnknownFields: ExtraUnknownField[] = [
    {
      target: 'request.settings.cookies',
      name: `future${faker.string.alpha(6)}`,
      value: { level1: { level2: [{ level3: faker.string.alpha(8), list: [1, 2, 3] }, faker.string.alpha(8)] } },
    },
    { target: 'folder.request.meta', name: `future${faker.string.alpha(6)}` },
    { target: 'environments.meta', name: `future${faker.string.alpha(6)}`, value: { enabled: true, items: [] } },
    { target: 'root', name: `future${faker.string.alpha(6)}`, value: [faker.string.alpha(8), [faker.number.int(100)]] },
  ];
  const { content } = buildCollectionFileWithUnknownField(faker.string.alpha(10), { extraUnknownFields });
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
  expect(highlightCount).toBeGreaterThanOrEqual(extraUnknownFields.length);
  expect(confirmationText).toContain('Unrecognized Fields');
});
