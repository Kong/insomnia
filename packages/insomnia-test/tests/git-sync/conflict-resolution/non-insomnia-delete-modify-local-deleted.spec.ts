import { commitLocalFiles,pushServerFile,test } from '@package/misc/git-fixtures';
import { expect } from '@playwright/test';

import { readRepoFile,setupGitProject,waitForRepoFile,WORKFLOW,workflowContent } from './helpers';

test('Verify a conflict where the remote modified a non-Insomnia YAML file deleted locally is auto-resolved to the remote version', async ({
  user,
}) => {
  const { gitSyncFlow } = user.flowManager;

  const { repoPath } = await setupGitProject(user, { [WORKFLOW]: workflowContent('echo base') });

  commitLocalFiles(repoPath, [{ path: WORKFLOW, delete: true }], 'Local delete');
  await pushServerFile({ path: WORKFLOW, content: workflowContent('echo remote'), message: 'Remote modify' });
  await gitSyncFlow.pull();
  await waitForRepoFile(repoPath, WORKFLOW, workflowContent('echo remote'));
  const pullIssues = await gitSyncFlow.getPullIssues();

  expect(readRepoFile(repoPath, WORKFLOW)).toBe(workflowContent('echo remote'));
  expect(pullIssues).toEqual({ conflictModalOpen: false, validationErrorShown: false });
});
