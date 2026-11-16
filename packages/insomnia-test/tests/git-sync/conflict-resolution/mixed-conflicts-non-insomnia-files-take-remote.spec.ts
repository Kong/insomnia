import { test } from '@package/misc/git-fixtures';
import { expect } from '@playwright/test';

import {
GITIGNORE,
HELM,
helmContent,
readRepoFile,
setupMixedConflict,
waitForRepoFile,
WORKFLOW,
workflowContent,
} from './helpers';

test('Verify non-Insomnia files take the remote version when an Insomnia file conflicts in the same pull', async ({
  user,
}) => {
  const { gitSyncFlow } = user.flowManager;

  const { repoPath } = await setupMixedConflict(user);

  await gitSyncFlow.pullExpectingConflicts();
  await gitSyncFlow.resolvePullConflicts('Current');
  await waitForRepoFile(repoPath, WORKFLOW, workflowContent('echo remote'));

  expect(readRepoFile(repoPath, WORKFLOW)).toBe(workflowContent('echo remote'));
  expect(readRepoFile(repoPath, HELM)).toBe(helmContent('remote'));
  expect(readRepoFile(repoPath, GITIGNORE)).toBe('remote-ignore\n');
});
