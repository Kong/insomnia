import { faker } from '@faker-js/faker';
import { ProjectType } from '@package/enums/project-types';
import { buildCollectionFile, buildWorkflowFile, GIT_CREDENTIAL, pushServerFile, test, WORKFLOW_PATH } from '@package/misc/git-fixtures';
import { Collection } from '@package/models/collection';
import { Project } from '@package/models/project';
import { expect } from '@playwright/test';

test('Verify files changed only on the remote pull cleanly without a conflict modal', async ({ user }) => {
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

  const fileName = faker.string.alpha(10).toLowerCase();
  await workspaceFlow.createCollection(project, new Collection(faker.string.alphanumeric(10)), fileName);
  await gitSyncFlow.commitAndPush(faker.string.alphanumeric(10));
  const remoteCollectionFile = buildCollectionFile(faker.string.alpha(10));
  await pushServerFile({ path: `${fileName}.yaml`, content: remoteCollectionFile });
  await pushServerFile({ path: WORKFLOW_PATH, content: buildWorkflowFile('echo remote') });
  await gitSyncFlow.pull();
  await gitSyncFlow.waitForRepoFile(repoPath, WORKFLOW_PATH, buildWorkflowFile('echo remote'));
  await gitSyncFlow.waitForRepoFile(repoPath, `${fileName}.yaml`, remoteCollectionFile);
  const pullIssues = await gitSyncFlow.getPullIssues();

  expect(pullIssues).toEqual({ conflictModalOpen: false, validationErrorShown: false });
});
