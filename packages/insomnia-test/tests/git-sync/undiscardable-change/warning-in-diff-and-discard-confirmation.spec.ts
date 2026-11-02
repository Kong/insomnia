import { faker } from '@faker-js/faker';
import { expect } from "@playwright/test";

import { GitChangeList } from '../../../enums/git-change-list';
import { ProjectType } from '../../../enums/project-types';
import { DEFAULT_TIMEOUT, GIT_CREDENTIAL, pushServerFile, test } from "../../../misc/git-fixtures";
import { Project } from '../../../models/project';
import { buildReorderedCollectionFile, UNDISCARDABLE_WARNING_TEXT } from './helpers';

const variants = [
  { title: 'hand-reordered file', oldSchema: false },
  { title: 'file from an older schema that Insomnia only normalizes', oldSchema: true },
];

for (const { title, oldSchema } of variants) {
  test(`Verify a ${title} warns that the change cannot be discarded in both the diff and the discard confirmation`, async ({
    user,
  }) => {
    const { gitSyncFlow, preferencesFlow, workspaceFlow } = user.flowManager;
    const { gitSyncPage, gitCommitDialogPage } = user.pageManager;

    const fileName = `${faker.string.alpha(10).toLowerCase()}.yaml`;
    await pushServerFile({
      path: fileName,
      content: buildReorderedCollectionFile(faker.string.alpha(10), { oldSchema }).content,
    });
    await preferencesFlow.addGitCredential(GIT_CREDENTIAL);
    const { unknownFieldFiles, unknownFieldsWarningText } = await workspaceFlow.cloneWithScanReport(
      new Project(faker.string.alphanumeric(10), ProjectType.Git),
      GIT_CREDENTIAL.name,
    );
    await expect
      .poll(async () => (await gitSyncFlow.getChanges()).unstaged, {
        timeout: DEFAULT_TIMEOUT,
      })
      .toContain(fileName);

    await gitSyncPage.openCommitDialog();
    await gitCommitDialogPage.openChangeDiff(GitChangeList.Unstaged, fileName);
    const hasDiffWarning = await gitCommitDialogPage.isUndiscardableWarningVisible();
    const hasUnknownFieldsBanner = await gitCommitDialogPage.isUnknownFieldsDiffWarningVisible();
    const unknownFieldHighlightCount = await gitCommitDialogPage.getUnknownFieldHighlightCount();
    await gitCommitDialogPage.openDiscardConfirmation(fileName);

    expect(unknownFieldFiles).toEqual([]);
    expect(unknownFieldsWarningText).toBe('');
    expect(hasDiffWarning).toBe(true);
    expect(hasUnknownFieldsBanner).toBe(false);
    expect(unknownFieldHighlightCount).toBe(0);
    expect(await gitCommitDialogPage.isUndiscardableWarningVisibleInDiscardDialog()).toBe(true);
    expect(await gitCommitDialogPage.getDiscardConfirmationText()).toContain(UNDISCARDABLE_WARNING_TEXT);
  });
}
