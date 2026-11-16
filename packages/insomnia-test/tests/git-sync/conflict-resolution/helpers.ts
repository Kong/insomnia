import * as fs from 'node:fs';
import path from 'node:path';

import { faker } from '@faker-js/faker';
import { ProjectType } from '@package/enums/project-types';
import { DEFAULT_TIMEOUT,POLL_INTERVAL } from '@package/misc/constants';
import type { UserSession } from '@package/misc/fixtures';
import {
buildCollectionFile,
commitLocalFiles,
GIT_CREDENTIAL,
pushServerFile,
} from '@package/misc/git-fixtures';
import { Collection } from '@package/models/collection';
import { Project } from '@package/models/project';

export const WORKFLOW = '.github/workflows/main-deployment.yaml';
export const HELM = 'helm/deployment.yaml';
export const GITIGNORE = '.gitignore';

export const workflowContent = (step: string) => `name: deploy\non: push\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - run: ${step}\n`;
export const helmContent = (value: string) => `apiVersion: apps/v1\nspec:\n  replicas: {{ .Values.${value} }}\n`;

export function readRepoFile(repoPath: string, file: string): string | undefined {
  const target = path.join(repoPath, file);
  return fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : undefined;
}

export async function waitForRepoFile(repoPath: string, file: string, expected?: string): Promise<void> {
  const deadline = Date.now() + DEFAULT_TIMEOUT;
  while (Date.now() < deadline && readRepoFile(repoPath, file) !== expected) {
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
  }
}

export async function setupGitProject(user: UserSession, baseFiles: Record<string, string> = {}) {
  const { gitSyncFlow, preferencesFlow, workspaceFlow } = user.flowManager;

  await preferencesFlow.addGitCredential(GIT_CREDENTIAL);
  const project = await workspaceFlow.cloneGitProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Git),
    GIT_CREDENTIAL.name,
  );
  const repoPath = await workspaceFlow.getGitRepositoryPath(project);

  const entries = Object.entries(baseFiles);
  if (entries.length > 0) {
    for (const [filePath, content] of entries) {
      await pushServerFile({ path: filePath, content });
    }
    await gitSyncFlow.pull();
    for (const [filePath, content] of entries) {
      await waitForRepoFile(repoPath, filePath, content);
    }
  }
  return { project, repoPath };
}

export async function createSharedCollection(user: UserSession, project: Project) {
  const { gitSyncFlow, workspaceFlow } = user.flowManager;
  const fileName = faker.string.alpha(10).toLowerCase();
  const collection = await workspaceFlow.createCollection(
    project,
    new Collection(faker.string.alphanumeric(10)),
    fileName,
  );
  await gitSyncFlow.commitAndPush(faker.string.alphanumeric(10));
  return { collection, filePath: `${fileName}.yaml` };
}

export async function renameAndCommitLocally(user: UserSession, collection: Collection) {
  const { gitSyncFlow, workspaceFlow } = user.flowManager;
  const localCollection = new Collection(faker.string.alpha(10));
  await workspaceFlow.renameCollection(collection, localCollection.name);
  await gitSyncFlow.commit(faker.string.alphanumeric(10));
  return localCollection;
}

export async function setupMixedConflict(user: UserSession) {
  const { project, repoPath } = await setupGitProject(user, {
    [WORKFLOW]: workflowContent('echo base'),
    [HELM]: helmContent('base'),
    [GITIGNORE]: 'node_modules\n',
  });
  const { collection, filePath } = await createSharedCollection(user, project);

  const localCollection = await renameAndCommitLocally(user, collection);
  commitLocalFiles(
    repoPath,
    [
      { path: WORKFLOW, content: workflowContent('echo local') },
      { path: HELM, content: helmContent('local') },
      { path: GITIGNORE, content: 'local-ignore\n' },
    ],
    'Local non-Insomnia changes',
  );
  const remoteCollection = new Collection(faker.string.alpha(10));
  await pushServerFile({ path: filePath, content: buildCollectionFile(remoteCollection.name) });
  await pushServerFile({ path: WORKFLOW, content: workflowContent('echo remote') });
  await pushServerFile({ path: HELM, content: helmContent('remote') });
  await pushServerFile({ path: GITIGNORE, content: 'remote-ignore\n' });
  return { repoPath, localCollection, remoteCollection };
}
