import * as fs from 'node:fs';
import path from 'node:path';

import { faker } from '@faker-js/faker';
import { ProjectType } from '@package/enums/project-types';
import { GIT_CREDENTIAL, pushServerFile, test } from '@package/misc/git-fixtures';
import { Collection } from '@package/models/collection';
import { Project } from '@package/models/project';
import { expect } from '@playwright/test';


test('Verify a delete/modify conflict on an Insomnia file still opens the Resolve conflicts modal', async ({ user }) => {
  const { gitSyncFlow, preferencesFlow, workspaceFlow } = user.flowManager;

  await preferencesFlow.addGitCredential(GIT_CREDENTIAL);
  const project = await workspaceFlow.cloneGitProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Git),
    GIT_CREDENTIAL.name,
  );

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
  await pushServerFile({ path: `${fileName}.yaml`, delete: true, message: 'Remote delete' });

  const conflicted = await gitSyncFlow.pullExpectingConflicts();
  await gitSyncFlow.resolvePullConflicts('Current');
  const pullIssues = await gitSyncFlow.getPullIssues();

  expect(conflicted).toHaveLength(1);
  expect(conflicted[0]).toBe(localCollection.name);
  expect(pullIssues.conflictModalOpen).toBe(false);
});
