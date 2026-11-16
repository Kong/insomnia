import * as fs from 'node:fs';
import path from 'node:path';

import { faker } from '@faker-js/faker';
import { ProjectType } from '@package/enums/project-types';
import { commitLocalFiles, DEFAULT_TIMEOUT, GIT_CREDENTIAL, pushServerFile, test } from '@package/misc/git-fixtures';
import { Project } from '@package/models/project';
import { expect } from '@playwright/test';

const workflow = (step: string) => `name: deploy\non: push\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - run: ${step}\n`;
const WORKFLOW = '.github/workflows/main-deployment.yaml';

test('Verify a GitHub workflow YAML conflict is auto-resolved to the remote version on pull', async ({ user }) => {
  const { gitSyncFlow, preferencesFlow, workspaceFlow } = user.flowManager;

  await preferencesFlow.addGitCredential(GIT_CREDENTIAL);
  const project = await workspaceFlow.cloneGitProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Git),
    GIT_CREDENTIAL.name,
  );
  const repoPath = await workspaceFlow.getGitRepositoryPath(project);

  await pushServerFile({ path: WORKFLOW, content: workflow('echo base') });
  await gitSyncFlow.pull();
  await expect
    .poll(() => fs.existsSync(path.join(repoPath, WORKFLOW)), { timeout: DEFAULT_TIMEOUT })
    .toBe(true);

  commitLocalFiles(repoPath, [{ path: WORKFLOW, content: workflow('echo local') }], 'Local workflow');
  await pushServerFile({ path: WORKFLOW, content: workflow('echo remote') });
  await gitSyncFlow.pull();
  await expect
    .poll(() => (fs.existsSync(path.join(repoPath, WORKFLOW)) ? fs.readFileSync(path.join(repoPath, WORKFLOW), 'utf8') : undefined), { timeout: DEFAULT_TIMEOUT })
    .toBe(workflow('echo remote'));
  const pullIssues = await gitSyncFlow.getPullIssues();

  expect(pullIssues).toEqual({ conflictModalOpen: false, validationErrorShown: false });
});
