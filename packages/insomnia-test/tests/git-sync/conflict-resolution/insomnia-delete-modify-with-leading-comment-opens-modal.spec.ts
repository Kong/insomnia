import { faker } from '@faker-js/faker';
import { ConflictResolution } from '@package/enums/conflict-resolution';
import { ProjectType } from '@package/enums/project-types';
import { commitLocalFiles, GIT_CREDENTIAL, pushServerFile, test } from '@package/misc/git-fixtures';
import { Collection } from '@package/models/collection';
import { Project } from '@package/models/project';
import { expect } from '@playwright/test';

test('Verify a delete/modify conflict on an Insomnia file with a hand-written comment on its first line still opens the Resolve conflicts modal', async ({ user }) => {
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

  const original = gitSyncFlow.readRepoFile(repoPath, filePath)!;
  const localContent = `# ${faker.string.alpha(10)}\n${original}`;
  commitLocalFiles(repoPath, [{ path: filePath, content: localContent }], faker.string.alphanumeric(10));
  await pushServerFile({ path: filePath, delete: true, message: faker.string.alphanumeric(10) });

  const conflicted = await gitSyncFlow.pullExpectingConflicts();
  await gitSyncFlow.resolvePullConflicts(ConflictResolution.Current);
  await gitSyncFlow.waitForRepoFileContaining(repoPath, filePath, collection.name);
  const pullIssues = await gitSyncFlow.getPullIssues();

  expect(conflicted).toEqual([collection.name]);
  expect(pullIssues.conflictModalOpen).toBe(false);
  expect(gitSyncFlow.readRepoFile(repoPath, filePath)).toContain(collection.name);
});
