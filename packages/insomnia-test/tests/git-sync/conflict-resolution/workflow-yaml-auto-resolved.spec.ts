import { commitLocalFiles,pushServerFile,test } from '@package/misc/git-fixtures';
import { expect } from '@playwright/test';

import { readRepoFile,setupGitProject,waitForRepoFile,WORKFLOW,workflowContent } from './helpers';

test('Verify a GitHub workflow YAML conflict is auto-resolved to the remote version on pull', async ({ user }) => {
  const { gitSyncFlow } = user.flowManager;

  const { repoPath } = await setupGitProject(user, { [WORKFLOW]: workflowContent('echo base') });

  commitLocalFiles(repoPath, [{ path: WORKFLOW, content: workflowContent('echo local') }], 'Local workflow');
  await pushServerFile({ path: WORKFLOW, content: workflowContent('echo remote') });
  await gitSyncFlow.pull();
  await waitForRepoFile(repoPath, WORKFLOW, workflowContent('echo remote'));
  const pullIssues = await gitSyncFlow.getPullIssues();

  expect(readRepoFile(repoPath, WORKFLOW)).toBe(workflowContent('echo remote'));
  expect(pullIssues).toEqual({ conflictModalOpen: false, validationErrorShown: false });
});
