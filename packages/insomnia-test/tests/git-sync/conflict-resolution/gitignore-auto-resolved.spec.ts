import { commitLocalFiles,pushServerFile,test } from '@package/misc/git-fixtures';
import { expect } from '@playwright/test';

import { GITIGNORE,readRepoFile,setupGitProject,waitForRepoFile } from './helpers';

test('Verify a conflicted non-YAML file (.gitignore) is still auto-resolved to the remote version', async ({ user }) => {
  const { gitSyncFlow } = user.flowManager;

  const { repoPath } = await setupGitProject(user, { [GITIGNORE]: 'node_modules\n' });

  commitLocalFiles(repoPath, [{ path: GITIGNORE, content: 'local-ignore\n' }], 'Local gitignore');
  await pushServerFile({ path: GITIGNORE, content: 'remote-ignore\n' });
  await gitSyncFlow.pull();
  await waitForRepoFile(repoPath, GITIGNORE, 'remote-ignore\n');
  const pullIssues = await gitSyncFlow.getPullIssues();

  expect(readRepoFile(repoPath, GITIGNORE)).toBe('remote-ignore\n');
  expect(pullIssues).toEqual({ conflictModalOpen: false, validationErrorShown: false });
});
