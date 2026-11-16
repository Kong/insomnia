import { faker } from '@faker-js/faker';
import { buildCollectionFile,pushServerFile,test } from '@package/misc/git-fixtures';
import { Collection } from '@package/models/collection';
import { expect } from '@playwright/test';

import { createSharedCollection,readRepoFile,setupGitProject,waitForRepoFile,WORKFLOW,workflowContent } from './helpers';

test('Verify files changed only on the remote pull cleanly without a conflict modal', async ({ user }) => {
  const { gitSyncFlow } = user.flowManager;
  const { project, repoPath } = await setupGitProject(user, { [WORKFLOW]: workflowContent('echo base') });
  const { filePath } = await createSharedCollection(user, project);

  const remoteCollection = new Collection(faker.string.alpha(10));
  const remoteCollectionFile = buildCollectionFile(remoteCollection.name);
  await pushServerFile({ path: filePath, content: remoteCollectionFile });
  await pushServerFile({ path: WORKFLOW, content: workflowContent('echo remote') });
  await gitSyncFlow.pull();
  await waitForRepoFile(repoPath, WORKFLOW, workflowContent('echo remote'));
  await waitForRepoFile(repoPath, filePath, remoteCollectionFile);
  const pullIssues = await gitSyncFlow.getPullIssues();

  expect(readRepoFile(repoPath, WORKFLOW)).toBe(workflowContent('echo remote'));
  expect(readRepoFile(repoPath, filePath)).toBe(remoteCollectionFile);
  expect(pullIssues).toEqual({ conflictModalOpen: false, validationErrorShown: false });
});
