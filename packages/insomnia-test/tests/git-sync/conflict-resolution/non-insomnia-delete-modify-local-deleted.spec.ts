import { faker } from '@faker-js/faker';
import { ProjectType } from '@package/enums/project-types';
import { buildWorkflowFile, commitLocalFiles, GIT_CREDENTIAL, pushServerFile, test, WORKFLOW_PATH } from '@package/misc/git-fixtures';
import { Project } from '@package/models/project';
import { expect } from '@playwright/test';

test('Verify a conflict where the remote modified a non-Insomnia YAML file deleted locally is auto-resolved to the remote version', async ({ user }) => {
  const { gitSyncFlow, preferencesFlow, workspaceFlow } = user.flowManager;

  await preferencesFlow.addGitCredential(GIT_CREDENTIAL);
  const project = await workspaceFlow.cloneGitProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Git),
    GIT_CREDENTIAL.name,
  );
  const repoPath = await workspaceFlow.getGitRepositoryPath(project);

  await pushServerFile({ path: WORKFLOW_PATH, content: buildWorkflowFile('echo base') });
  await gitSyncFlow.pull();
  await gitSyncFlow.waitForRepoFile(repoPath, WORKFLOW_PATH);

  commitLocalFiles(repoPath, [{ path: WORKFLOW_PATH, delete: true }], 'Local delete');
  await pushServerFile({ path: WORKFLOW_PATH, content: buildWorkflowFile('echo remote'), message: 'Remote modify' });
  await gitSyncFlow.pull();
  await gitSyncFlow.waitForRepoFile(repoPath, WORKFLOW_PATH, buildWorkflowFile('echo remote'));
  const pullIssues = await gitSyncFlow.getPullIssues();

  expect(pullIssues).toEqual({ conflictModalOpen: false, validationErrorShown: false });
});
