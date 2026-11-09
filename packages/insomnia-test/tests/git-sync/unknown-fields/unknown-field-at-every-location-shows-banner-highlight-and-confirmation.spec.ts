import { faker } from '@faker-js/faker';
import { GitChangeList } from '@package/enums/git-change-list';
import { ProjectType } from '@package/enums/project-types';
import { DEFAULT_TIMEOUT, GIT_CREDENTIAL, pushServerFile, test } from "@package/misc/git-fixtures";
import { Project } from '@package/models/project';
import { expect } from "@playwright/test";

import { buildCollectionFileWithUnknownField, type UnknownFieldTarget } from './helpers';

const targets: UnknownFieldTarget[] = [
  'workspace.meta',
  'request',
  'request.meta',
  'request.settings',
  'folder',
  'folder.meta',
  'folder.request',
  'cookieJar',
  'cookieJar.meta',
  'environments',
  'request.settings.cookies',
  'folder.request.meta',
  'environments.meta',
  'root',
];

test.describe('Unknown field at one location of the collection file', () => {
  for (const target of targets) {
    test(`Verify an unknown field at ${target} is listed on Create Project, shows the banner and highlight, and asks for confirmation on commit`, async ({
      user,
    }) => {
      const { gitSyncFlow, preferencesFlow, workspaceFlow } = user.flowManager;
      const { gitSyncPage, gitCommitDialogPage } = user.pageManager;

      const fileName = `${faker.string.alpha(10).toLowerCase()}.yaml`;
      const { content } = buildCollectionFileWithUnknownField(faker.string.alpha(10), {
        omitDefaultUnknownField: true,
        extraUnknownFields: [{ target, name: `future${faker.string.alpha(6)}` }],
      });
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
      await gitCommitDialogPage.openChangeDiff(GitChangeList.Staged, fileName);
      const hasBanner = await gitCommitDialogPage.isUnknownFieldsDiffWarningVisible();
      const highlightCount = await gitCommitDialogPage.getUnknownFieldHighlightCountAcrossDiff();
      await gitCommitDialogPage.commitStaged(faker.lorem.sentence());
      const confirmationText = await gitCommitDialogPage.getUnknownFieldsConfirmationText();

      expect(unknownFieldFiles).toEqual([fileName]);
      expect(hasBanner).toBe(true);
      expect(highlightCount).toBeGreaterThan(0);
      expect(confirmationText).toContain('Unrecognized Fields');
    });
  }
});
