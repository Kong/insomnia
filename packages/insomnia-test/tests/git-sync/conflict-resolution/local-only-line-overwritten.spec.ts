import { commitLocalFiles,pushServerFile,test } from '@package/misc/git-fixtures';
import { expect } from '@playwright/test';

import { readRepoFile,setupGitProject,waitForRepoFile,WORKFLOW,workflowContent } from './helpers';

test('Verify a local-only line in a non-Insomnia YAML file is overwritten by the remote version on pull', async ({
  user,
}) => {
  const { gitSyncFlow } = user.flowManager;

  const { repoPath } = await setupGitProject(user, { [WORKFLOW]: workflowContent('echo base') });

  commitLocalFiles(
    repoPath,
    [{ path: WORKFLOW, content: `${workflowContent('echo local')}      - run: echo local-only-line\n` }],
    'Local workflow with an extra line',
  );
  await pushServerFile({ path: WORKFLOW, content: workflowContent('echo remote') });
  await gitSyncFlow.pull();
  await waitForRepoFile(repoPath, WORKFLOW, workflowContent('echo remote'));

  expect(readRepoFile(repoPath, WORKFLOW)).toBe(workflowContent('echo remote'));
  expect(readRepoFile(repoPath, WORKFLOW)).not.toContain('local-only-line');
});
