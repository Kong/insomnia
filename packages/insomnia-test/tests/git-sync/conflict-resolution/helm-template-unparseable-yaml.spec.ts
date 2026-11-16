import * as fs from 'node:fs';
import path from 'node:path';

import { faker } from '@faker-js/faker';
import { ProjectType } from '@package/enums/project-types';
import { commitLocalFiles, DEFAULT_TIMEOUT, GIT_CREDENTIAL, pushServerFile, test } from '@package/misc/git-fixtures';
import { Project } from '@package/models/project';
import { expect } from '@playwright/test';

const helm = (value: string) => `apiVersion: apps/v1\nspec:\n  replicas: {{ .Values.${value} }}\n`;
const HELM = 'helm/deployment.yaml';

test('Verify an unparseable YAML file (Helm template) conflict does not fail the pull', async ({ user }) => {
  const { gitSyncFlow, preferencesFlow, workspaceFlow } = user.flowManager;

  await preferencesFlow.addGitCredential(GIT_CREDENTIAL);
  const project = await workspaceFlow.cloneGitProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Git),
    GIT_CREDENTIAL.name,
  );
  const repoPath = await workspaceFlow.getGitRepositoryPath(project);

  await pushServerFile({ path: HELM, content: helm('base') });
  await gitSyncFlow.pull();
  await expect
    .poll(() => fs.existsSync(path.join(repoPath, HELM)), { timeout: DEFAULT_TIMEOUT })
    .toBe(true);

  commitLocalFiles(repoPath, [{ path: HELM, content: helm('local') }], 'Local helm');
  await pushServerFile({ path: HELM, content: helm('remote') });
  await gitSyncFlow.pull();
  await expect
    .poll(() => (fs.existsSync(path.join(repoPath, HELM)) ? fs.readFileSync(path.join(repoPath, HELM), 'utf8') : undefined), { timeout: DEFAULT_TIMEOUT })
    .toBe(helm('remote'));
  const pullIssues = await gitSyncFlow.getPullIssues();

  expect(pullIssues).toEqual({ conflictModalOpen: false, validationErrorShown: false });
});
