import { test } from '@package/misc/git-fixtures';
import { expect } from '@playwright/test';

import { setupMixedConflict } from './helpers';

test('Verify only the Insomnia file is listed in the Resolve conflicts modal when several files conflict', async ({
  user,
}) => {
  const { gitSyncFlow } = user.flowManager;

  const { localCollection, remoteCollection } = await setupMixedConflict(user);

  const conflicted = await gitSyncFlow.pullExpectingConflicts();
  await gitSyncFlow.resolvePullConflicts('Current');

  expect(conflicted).toHaveLength(1);
  expect([localCollection.name, remoteCollection.name]).toContain(conflicted[0]);
});
