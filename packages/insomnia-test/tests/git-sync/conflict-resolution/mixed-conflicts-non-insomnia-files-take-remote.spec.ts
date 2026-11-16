import * as fs from 'node:fs';
import path from 'node:path';

import { faker } from '@faker-js/faker';
import { ProjectType } from '@package/enums/project-types';
import { buildCollectionFile, commitLocalFiles, DEFAULT_TIMEOUT, GIT_CREDENTIAL, pushServerFile, test } from '@package/misc/git-fixtures';
import { Collection } from '@package/models/collection';
import { Project } from '@package/models/project';
import { expect } from '@playwright/test';

const workflow = (step: string) => `name: deploy\non: push\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - run: ${step}\n`;
const WORKFLOW = '.github/workflows/main-deployment.yaml';
const helm = (value: string) => `apiVersion: apps/v1\nspec:\n  replicas: {{ .Values.${value} }}\n`;
const HELM = 'helm/deployment.yaml';
const GITIGNORE = '.gitignore';

test('Verify non-Insomnia files take the remote version when an Insomnia file conflicts in the same pull', async ({ user }) => {
  const { gitSyncFlow, preferencesFlow, workspaceFlow } = user.flowManager;

  await preferencesFlow.addGitCredential(GIT_CREDENTIAL);
  const project = await workspaceFlow.cloneGitProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Git),
    GIT_CREDENTIAL.name,
  );
  const repoPath = await workspaceFlow.getGitRepositoryPath(project);

  await pushServerFile({ path: WORKFLOW, content: workflow('echo base') });
  await pushServerFile({ path: HELM, content: helm('base') });
  await pushServerFile({ path: GITIGNORE, content: 'node_modules\n' });
  await gitSyncFlow.pull();
  await expect
    .poll(() => fs.existsSync(path.join(repoPath, GITIGNORE)), { timeout: DEFAULT_TIMEOUT })
    .toBe(true);

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
      { path: WORKFLOW, content: workflow('echo local') },
      { path: HELM, content: helm('local') },
      { path: GITIGNORE, content: 'local-ignore\n' },
    ],
    'Local non-Insomnia changes',
  );
  const remoteCollection = new Collection(faker.string.alpha(10));
  await pushServerFile({ path: `${fileName}.yaml`, content: buildCollectionFile(remoteCollection.name) });
  await pushServerFile({ path: WORKFLOW, content: workflow('echo remote') });
  await pushServerFile({ path: HELM, content: helm('remote') });
  await pushServerFile({ path: GITIGNORE, content: 'remote-ignore\n' });

  await gitSyncFlow.pullExpectingConflicts();
  await gitSyncFlow.resolvePullConflicts('Current');

  await expect
    .poll(() => (fs.existsSync(path.join(repoPath, WORKFLOW)) ? fs.readFileSync(path.join(repoPath, WORKFLOW), 'utf8') : undefined), { timeout: DEFAULT_TIMEOUT })
    .toBe(workflow('echo remote'));
  expect(fs.readFileSync(path.join(repoPath, HELM), 'utf8')).toBe(helm('remote'));
  expect(fs.readFileSync(path.join(repoPath, GITIGNORE), 'utf8')).toBe('remote-ignore\n');
});
