import { faker } from '@faker-js/faker';
import { ProjectType } from '@package/enums/project-types';
import { buildHelmFile, buildWorkflowFile, commitLocalFiles, GIT_CREDENTIAL, GITIGNORE_PATH, HELM_PATH, pushServerFile, test, WORKFLOW_PATH } from '@package/misc/git-fixtures';
import { Project } from '@package/models/project';
import { expect } from '@playwright/test';

test('Verify conflicting non-Insomnia files (workflow YAML, Helm template, .gitignore) are auto-resolved to the remote version on pull', async ({ user }) => {
  const { gitSyncFlow, preferencesFlow, workspaceFlow } = user.flowManager;

  await preferencesFlow.addGitCredential(GIT_CREDENTIAL);
  const project = await workspaceFlow.cloneGitProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Git),
    GIT_CREDENTIAL.name,
  );
  const repoPath = await workspaceFlow.getGitRepositoryPath(project);

  await pushServerFile({ path: WORKFLOW_PATH, content: buildWorkflowFile('echo base') });
  await pushServerFile({ path: HELM_PATH, content: buildHelmFile('base') });
  await pushServerFile({ path: GITIGNORE_PATH, content: 'node_modules\n' });
  await gitSyncFlow.pull();
  await gitSyncFlow.waitForRepoFile(repoPath, GITIGNORE_PATH);

  commitLocalFiles(
    repoPath,
    [
      { path: WORKFLOW_PATH, content: `${buildWorkflowFile('echo local')}      - run: echo local-only-line\n` },
      { path: HELM_PATH, content: buildHelmFile('local') },
      { path: GITIGNORE_PATH, content: 'local-ignore\n' },
    ],
    'Local non-Insomnia changes',
  );
  await pushServerFile({ path: WORKFLOW_PATH, content: buildWorkflowFile('echo remote') });
  await pushServerFile({ path: HELM_PATH, content: buildHelmFile('remote') });
  await pushServerFile({ path: GITIGNORE_PATH, content: 'remote-ignore\n' });
  await gitSyncFlow.pull();
  await gitSyncFlow.waitForRepoFile(repoPath, GITIGNORE_PATH, 'remote-ignore\n');
  const pullIssues = await gitSyncFlow.getPullIssues();

  expect(pullIssues).toEqual({ conflictModalOpen: false, validationErrorShown: false });
  expect(gitSyncFlow.readRepoFile(repoPath, WORKFLOW_PATH)).toBe(buildWorkflowFile('echo remote'));
  expect(gitSyncFlow.readRepoFile(repoPath, HELM_PATH)).toBe(buildHelmFile('remote'));
  expect(gitSyncFlow.readRepoFile(repoPath, GITIGNORE_PATH)).toBe('remote-ignore\n');
});
