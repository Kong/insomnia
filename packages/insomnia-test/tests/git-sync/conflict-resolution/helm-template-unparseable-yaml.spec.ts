import { commitLocalFiles,pushServerFile,test } from '@package/misc/git-fixtures';
import { expect } from '@playwright/test';

import { HELM,helmContent,readRepoFile,setupGitProject,waitForRepoFile } from './helpers';

test('Verify an unparseable YAML file (Helm template) conflict does not fail the pull', async ({ user }) => {
  const { gitSyncFlow } = user.flowManager;

  const { repoPath } = await setupGitProject(user, { [HELM]: helmContent('base') });

  commitLocalFiles(repoPath, [{ path: HELM, content: helmContent('local') }], 'Local helm');
  await pushServerFile({ path: HELM, content: helmContent('remote') });
  await gitSyncFlow.pull();
  await waitForRepoFile(repoPath, HELM, helmContent('remote'));
  const pullIssues = await gitSyncFlow.getPullIssues();

  expect(readRepoFile(repoPath, HELM)).toBe(helmContent('remote'));
  expect(pullIssues).toEqual({ conflictModalOpen: false, validationErrorShown: false });
});
