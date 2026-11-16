import * as fs from 'node:fs';
import path from 'node:path';

import { faker } from '@faker-js/faker';
import { ProjectType } from '@package/enums/project-types';
import { buildCollectionFile, DEFAULT_TIMEOUT, GIT_CREDENTIAL, pushServerFile, test } from '@package/misc/git-fixtures';
import { Collection } from '@package/models/collection';
import { Project } from '@package/models/project';
import { expect } from '@playwright/test';

const workflow = (step: string) => `name: deploy\non: push\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - run: ${step}\n`;
const WORKFLOW = '.github/workflows/main-deployment.yaml';

test('Verify files changed only on the remote pull cleanly without a conflict modal', async ({ user }) => {
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

  const fileName = faker.string.alpha(10).toLowerCase();
  await workspaceFlow.createCollection(project, new Collection(faker.string.alphanumeric(10)), fileName);
  await gitSyncFlow.commitAndPush(faker.string.alphanumeric(10));
  const remoteCollectionFile = buildCollectionFile(faker.string.alpha(10));
  await pushServerFile({ path: `${fileName}.yaml`, content: remoteCollectionFile });
  await pushServerFile({ path: WORKFLOW, content: workflow('echo remote') });
  await gitSyncFlow.pull();
  await expect
    .poll(() => (fs.existsSync(path.join(repoPath, WORKFLOW)) ? fs.readFileSync(path.join(repoPath, WORKFLOW), 'utf8') : undefined), { timeout: DEFAULT_TIMEOUT })
    .toBe(workflow('echo remote'));
  await expect
    .poll(() => (fs.existsSync(path.join(repoPath, `${fileName}.yaml`)) ? fs.readFileSync(path.join(repoPath, `${fileName}.yaml`), 'utf8') : undefined), { timeout: DEFAULT_TIMEOUT })
    .toBe(remoteCollectionFile);
  const pullIssues = await gitSyncFlow.getPullIssues();

  expect(pullIssues).toEqual({ conflictModalOpen: false, validationErrorShown: false });
});
