import { faker } from '@faker-js/faker';
import { ConflictResolution } from '@package/enums/conflict-resolution';
import { ProjectType } from '@package/enums/project-types';
import { commitLocalFiles, GIT_CREDENTIAL, pushServerFile, test } from '@package/misc/git-fixtures';
import { Project } from '@package/models/project';
import { expect } from '@playwright/test';

const FILE_TYPES = [
  { label: 'API spec', type: 'spec.insomnia.rest/5.0', extra: ['spec:', '  contents: {}'] },
  { label: 'MCP client', type: 'mcpClient.insomnia/5.0', extra: [] },
];

const buildFile = (type: string, extra: string[], name: string) =>
  [
    `type: ${type}`,
    'schema_version: "5.1"',
    `name: ${name}`,
    'meta:',
    `  id: wrk_${faker.string.hexadecimal({ length: 32, prefix: '', casing: 'lower' })}`,
    '  created: 1700000000000',
    '  modified: 1700000000000',
    ...extra,
    '',
  ].join('\n');

for (const { label, type, extra } of FILE_TYPES) {
  test(`Verify a ${label} Insomnia file conflict still opens the Resolve conflicts modal`, async ({ user }) => {
    const { gitSyncFlow, preferencesFlow, workspaceFlow } = user.flowManager;

    await preferencesFlow.addGitCredential(GIT_CREDENTIAL);
    const project = await workspaceFlow.cloneGitProject(
      new Project(faker.string.alphanumeric(10), ProjectType.Git),
      GIT_CREDENTIAL.name,
    );
    const repoPath = await workspaceFlow.getGitRepositoryPath(project);
    const file = `${faker.string.alphanumeric(10)}.yaml`;
    const baseName = faker.string.alpha(10);
    const localName = faker.string.alpha(10);
    const remoteName = faker.string.alpha(10);

    await pushServerFile({ path: file, content: buildFile(type, extra, baseName) });
    await gitSyncFlow.pull();
    await gitSyncFlow.waitForRepoFile(repoPath, file);
    await gitSyncFlow.waitForCleanWorktree(repoPath);
    const canonical = gitSyncFlow.readRepoFile(repoPath, file)!;
    const withName = (name: string) => canonical.replace(`name: ${baseName}`, `name: ${name}`);

    commitLocalFiles(repoPath, [{ path: file, content: withName(localName) }], `Local ${label}`);
    await pushServerFile({ path: file, content: withName(remoteName) });

    const conflicted = await gitSyncFlow.pullExpectingConflicts();
    await gitSyncFlow.resolvePullConflicts(ConflictResolution.Current);
    const pullIssues = await gitSyncFlow.getPullIssues();

    expect(canonical.split('\n')[0]).toBe(`type: ${type}`);
    expect(conflicted).toHaveLength(1);
    expect(pullIssues.conflictModalOpen).toBe(false);
  });
}
