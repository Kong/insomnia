import { commitLocalFiles,pushServerFile,test } from '@package/misc/git-fixtures';
import { expect } from '@playwright/test';

import { readRepoFile,setupGitProject,waitForRepoFile,WORKFLOW,workflowContent } from './helpers';

test('Verify a conflict where the remote deleted a non-Insomnia YAML file is auto-resolved by deleting it locally', async ({
  user,
}) => {
  test.fail();

  const { gitSyncFlow } = user.flowManager;

  const { repoPath } = await setupGitProject(user, { [WORKFLOW]: workflowContent('echo base') });

  commitLocalFiles(repoPath, [{ path: WORKFLOW, content: workflowContent('echo local') }], 'Local modify');
  await pushServerFile({ path: WORKFLOW, delete: true, message: 'Remote delete' });
  await gitSyncFlow.pull();
  await waitForRepoFile(repoPath, WORKFLOW);
  const pullIssues = await gitSyncFlow.getPullIssues();

  expect(readRepoFile(repoPath, WORKFLOW)).toBeUndefined();
  expect(pullIssues).toEqual({ conflictModalOpen: false, validationErrorShown: false });
});
