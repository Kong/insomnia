import { faker } from '@faker-js/faker';
import { ConflictResolution } from '@package/enums/conflict-resolution';
import { ProjectType } from '@package/enums/project-types';
import { buildCollectionFile, GIT_CREDENTIAL, pushServerFile, test } from '@package/misc/git-fixtures';
import { Collection } from '@package/models/collection';
import { Project } from '@package/models/project';
import { expect } from '@playwright/test';

test('Verify a conflict on an Insomnia file with a hand-written comment on its first line on the remote opens the Resolve conflicts modal and Incoming takes the remote version', async ({ user }) => {
  const { gitSyncFlow, preferencesFlow, workspaceFlow } = user.flowManager;

  await preferencesFlow.addGitCredential(GIT_CREDENTIAL);

  const project = await workspaceFlow.cloneGitProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Git),
    GIT_CREDENTIAL.name,
  );
  const repoPath = await workspaceFlow.getGitRepositoryPath(project);
  const fileName = faker.string.alpha(10).toLowerCase();
  const filePath = `${fileName}.yaml`;
  const collection = await workspaceFlow.createCollection(
    project,
    new Collection(faker.string.alphanumeric(10)),
    fileName,
  );
  await gitSyncFlow.commitAndPush(faker.string.alphanumeric(10));

  const localCollection = new Collection(faker.string.alpha(10));
  await workspaceFlow.renameCollection(collection, localCollection.name);
  await gitSyncFlow.commit(faker.string.alphanumeric(10));

  const handWrittenComment = `# ${faker.string.alpha(10)}`;
  const remoteCollection = new Collection(faker.string.alpha(10));
  await pushServerFile({ path: filePath, content: `${handWrittenComment}\n${buildCollectionFile(remoteCollection.name)}` });

  const conflicted = await gitSyncFlow.pullExpectingConflicts();
  await gitSyncFlow.resolvePullConflicts(ConflictResolution.Incoming);
  await gitSyncFlow.waitForRepoFileContaining(repoPath, filePath, remoteCollection.name);
  const pullIssues = await gitSyncFlow.getPullIssues();

  expect(conflicted).toHaveLength(1);
  expect(pullIssues.conflictModalOpen).toBe(false);
  expect(gitSyncFlow.readRepoFile(repoPath, filePath)).toContain(remoteCollection.name);
  expect(gitSyncFlow.readRepoFile(repoPath, filePath)).not.toContain(localCollection.name);
});
