import * as fs from 'node:fs';
import path from 'node:path';

import { faker } from '@faker-js/faker';
import { ProjectType } from '@package/enums/project-types';
import { commitLocalFiles, DEFAULT_TIMEOUT, GIT_CREDENTIAL, pushServerFile, test } from '@package/misc/git-fixtures';
import { Project } from '@package/models/project';
import { expect } from '@playwright/test';

const GITIGNORE = '.gitignore';

test('Verify a conflicted non-YAML file (.gitignore) is still auto-resolved to the remote version', async ({ user }) => {
  const { gitSyncFlow, preferencesFlow, workspaceFlow } = user.flowManager;

  await preferencesFlow.addGitCredential(GIT_CREDENTIAL);
  const project = await workspaceFlow.cloneGitProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Git),
    GIT_CREDENTIAL.name,
  );
  const repoPath = await workspaceFlow.getGitRepositoryPath(project);

  await pushServerFile({ path: GITIGNORE, content: 'node_modules\n' });
  await gitSyncFlow.pull();
  await expect
    .poll(() => fs.existsSync(path.join(repoPath, GITIGNORE)), { timeout: DEFAULT_TIMEOUT })
    .toBe(true);

  commitLocalFiles(repoPath, [{ path: GITIGNORE, content: 'local-ignore\n' }], 'Local gitignore');
  await pushServerFile({ path: GITIGNORE, content: 'remote-ignore\n' });
  await gitSyncFlow.pull();
  await expect
    .poll(() => (fs.existsSync(path.join(repoPath, GITIGNORE)) ? fs.readFileSync(path.join(repoPath, GITIGNORE), 'utf8') : undefined), { timeout: DEFAULT_TIMEOUT })
    .toBe('remote-ignore\n');
  const pullIssues = await gitSyncFlow.getPullIssues();

  expect(pullIssues).toEqual({ conflictModalOpen: false, validationErrorShown: false });
});
