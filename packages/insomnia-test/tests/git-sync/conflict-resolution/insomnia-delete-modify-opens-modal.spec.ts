import { pushServerFile,test } from '@package/misc/git-fixtures';
import { expect } from '@playwright/test';

import { createSharedCollection,renameAndCommitLocally,setupGitProject } from './helpers';

test('Verify a delete/modify conflict on an Insomnia file still opens the Resolve conflicts modal', async ({
  user,
}) => {
  const { gitSyncFlow } = user.flowManager;
  const { project } = await setupGitProject(user);
  const { collection, filePath } = await createSharedCollection(user, project);

  const localCollection = await renameAndCommitLocally(user, collection);
  await pushServerFile({ path: filePath, delete: true, message: 'Remote delete' });
  const conflicted = await gitSyncFlow.pullExpectingConflicts();
  await gitSyncFlow.resolvePullConflicts('Current');
  const pullIssues = await gitSyncFlow.getPullIssues();

  expect(conflicted).toHaveLength(1);
  expect(conflicted[0]).toBe(localCollection.name);
  expect(pullIssues.conflictModalOpen).toBe(false);
});
