import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { faker } from '@faker-js/faker';

import { GitChangeList } from '../../../enums/git-change-list';
import { ProjectType } from '../../../enums/project-types';
import { DEFAULT_TIMEOUT, expect, GIT_CREDENTIAL, pushServerFile,test } from '../../../misc/git-fixtures';
import { Project } from '../../../models/project';
import { buildSeedCollectionFile, buildSeedRequest } from './helpers';

test('Verify entity actions on one request keep a hand-added unknown field on another request and add no ghost change', async ({ user }) => {
  test.fail(true, "INS-4077");

  const { gitSyncFlow, preferencesFlow, workspaceFlow } = user.flowManager;
  const { gitSyncPage } = user.pageManager;

  const workspace = { id: `wrk_${faker.string.alphanumeric({ length: 16, casing: 'lower' })}`, name: faker.string.alpha(10), environmentId: `env_${faker.string.alphanumeric({ length: 16, casing: 'lower' })}` };
  const [first, second] = [
    { id: `req_${faker.string.alphanumeric({ length: 16, casing: 'lower' })}`, name: faker.string.alpha(10) },
    { id: `req_${faker.string.alphanumeric({ length: 16, casing: 'lower' })}`, name: faker.string.alpha(10) },
  ];
  const unknownValue = faker.string.alphanumeric(12);
  const fileName = `${faker.string.alpha(10).toLowerCase()}.yaml`;
  const seedFiles: Record<string, string> = {
    [fileName]: buildSeedCollectionFile(workspace, [
      buildSeedRequest(first.id, first.name, 'https://example.com/first'),
      buildSeedRequest(second.id, second.name, 'https://example.com/second'),
    ]),
  };
  for (const [filePath, content] of Object.entries(seedFiles)) {
    await pushServerFile({ path: filePath, content });
  }
  await preferencesFlow.addGitCredential(GIT_CREDENTIAL);
  const cloneParentDir = fs.mkdtempSync(path.join(os.tmpdir(), 'insomnia-visual-diff-'));
  await workspaceFlow.create(new Project(faker.string.alphanumeric(10), ProjectType.Git), GIT_CREDENTIAL.name, { cloneParentDir });
  const cloneDir = path.join(cloneParentDir, fs.readdirSync(cloneParentDir)[0]);
  fs.writeFileSync(path.join(cloneDir, fileName), buildSeedCollectionFile(workspace, [
      buildSeedRequest(first.id, first.name, 'https://example.com/first-edited'),
      buildSeedRequest(second.id, second.name, 'https://example.com/second', { unknownField: unknownValue }),
    ]));
  await expect.poll(async () => gitSyncPage.hasUncommittedChanges(), { timeout: DEFAULT_TIMEOUT }).toBe(true);

  await gitSyncFlow.openVisualDiff(GitChangeList.Unstaged, fileName);
  await gitSyncFlow.stageEntity(fileName, first.name);
  const indexAfterStage = execSync(`git show :${fileName}`, { cwd: cloneDir, encoding: 'utf8' });
  await gitSyncFlow.unstageEntity(fileName, first.name);
  await gitSyncFlow.discardEntity(fileName, first.name);
  const cardsAfterDiscard = await gitSyncPage.getEntityCardNames();
  const secondTabsAfterDiscard = await gitSyncPage.getEntityCardTabs(second.name);
  const fileAfterDiscard = fs.readFileSync(path.join(cloneDir, fileName), 'utf8');

  expect(indexAfterStage).not.toContain(unknownValue);
  expect(cardsAfterDiscard).toEqual([second.name]);
  expect(secondTabsAfterDiscard).toEqual(['Settings 1']);
  expect(fileAfterDiscard).toContain(unknownValue);
});
