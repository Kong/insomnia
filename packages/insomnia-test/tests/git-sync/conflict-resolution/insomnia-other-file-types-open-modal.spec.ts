import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import path from 'node:path';

import { faker } from '@faker-js/faker';
import { ProjectType } from '@package/enums/project-types';
import { commitLocalFiles, DEFAULT_TIMEOUT, GIT_CREDENTIAL, pushServerFile, test } from '@package/misc/git-fixtures';
import { Project } from '@package/models/project';
import { expect } from '@playwright/test';

// Insomnia file types the app has no UI to author a Git Sync file for. The
// collection is covered by the mixed-conflicts specs, the global environment by
// insomnia-environment-opens-modal.spec.ts and the mock server by
// insomnia-mock-server-opens-modal.spec.ts (the app rewrites an externally
// edited mock server file on pull, so it has to be authored through the UI).
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
    await expect.poll(() => fs.existsSync(path.join(repoPath, file)), { timeout: DEFAULT_TIMEOUT }).toBe(true);

    // The app rewrites the file in its canonical format after the first pull, so
    // derive the local and remote versions from what it wrote instead of the raw seed.
    const worktreeStatus = () => execFileSync('git', ['status', '--porcelain'], { cwd: repoPath }).toString().trim();
    await expect.poll(worktreeStatus, { timeout: DEFAULT_TIMEOUT }).toBe('');
    const canonical = fs.readFileSync(path.join(repoPath, file), 'utf8');
    expect(canonical.split('\n')[0]).toBe(`type: ${type}`);
    const withName = (name: string) => canonical.replace(`name: ${baseName}`, `name: ${name}`);

    commitLocalFiles(repoPath, [{ path: file, content: withName(localName) }], `Local ${label}`);
    await pushServerFile({ path: file, content: withName(remoteName) });

    const conflicted = await gitSyncFlow.pullExpectingConflicts();
    await gitSyncFlow.resolvePullConflicts('Current');
    const pullIssues = await gitSyncFlow.getPullIssues();

    expect(conflicted).toHaveLength(1);
    expect(pullIssues.conflictModalOpen).toBe(false);
  });
}
