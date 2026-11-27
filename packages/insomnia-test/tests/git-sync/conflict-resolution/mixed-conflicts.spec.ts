import { faker } from '@faker-js/faker';
import { ConflictResolution } from '@package/enums/conflict-resolution';
import { ProjectType } from '@package/enums/project-types';
import { buildCollectionFile, buildHelmFile, buildWorkflowFile, commitLocalFiles, GIT_CREDENTIAL, GITIGNORE_PATH, HELM_PATH, pushServerFile, test, WORKFLOW_PATH } from '@package/misc/git-fixtures';
import { Collection } from '@package/models/collection';
import { Project } from '@package/models/project';
import { expect } from '@playwright/test';

test('Verify only the Insomnia file is listed in the Resolve conflicts modal and non-Insomnia files take the remote version when several files conflict', async ({ user }) => {
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

  const fileName = faker.string.alpha(10).toLowerCase();
  const collection = await workspaceFlow.createCollection(
    project,
    new Collection(faker.string.alphanumeric(10)),
    fileName,
  );
  await gitSyncFlow.commitAndPush(faker.string.alphanumeric(10));
  const localCollection = new Collection(faker.string.alpha(10));
  await workspaceFlow.renameCollection(collection, localCollection.name);
  await gitSyncFlow.commit(faker.string.alphanumeric(10));
  commitLocalFiles(
    repoPath,
    [
      { path: WORKFLOW_PATH, content: buildWorkflowFile('echo local') },
      { path: HELM_PATH, content: buildHelmFile('local') },
      { path: GITIGNORE_PATH, content: 'local-ignore\n' },
    ],
    'Local non-Insomnia changes',
  );
  const remoteCollection = new Collection(faker.string.alpha(10));
  await pushServerFile({ path: `${fileName}.yaml`, content: buildCollectionFile(remoteCollection.name) });
  await pushServerFile({ path: WORKFLOW_PATH, content: buildWorkflowFile('echo remote') });
  await pushServerFile({ path: HELM_PATH, content: buildHelmFile('remote') });
  await pushServerFile({ path: GITIGNORE_PATH, content: 'remote-ignore\n' });

  const conflicted = await gitSyncFlow.pullExpectingConflicts();
  await gitSyncFlow.resolvePullConflicts(ConflictResolution.Current);
  await gitSyncFlow.waitForRepoFile(repoPath, WORKFLOW_PATH, buildWorkflowFile('echo remote'));
  await gitSyncFlow.waitForRepoFile(repoPath, HELM_PATH, buildHelmFile('remote'));
  await gitSyncFlow.waitForRepoFile(repoPath, GITIGNORE_PATH, 'remote-ignore\n');

  expect(conflicted).toHaveLength(1);
  expect([localCollection.name, remoteCollection.name]).toContain(conflicted[0]);
  expect(gitSyncFlow.readRepoFile(repoPath, WORKFLOW_PATH)).toBe(buildWorkflowFile('echo remote'));
  expect(gitSyncFlow.readRepoFile(repoPath, HELM_PATH)).toBe(buildHelmFile('remote'));
  expect(gitSyncFlow.readRepoFile(repoPath, GITIGNORE_PATH)).toBe('remote-ignore\n');
});
