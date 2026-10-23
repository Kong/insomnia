import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { faker } from '@faker-js/faker';

import { GitChangeList } from '../../../enums/git-change-list';
import { ProjectType } from '../../../enums/project-types';
import { DEFAULT_TIMEOUT, expect, GIT_CREDENTIAL, pushServerFile,test } from '../../../misc/git-fixtures';
import { Project } from '../../../models/project';

test('Verify unstaging or discarding a deleted folder restores only the empty folder and its requests one by one', async ({ user }) => {
  const { gitSyncFlow, preferencesFlow, workspaceFlow } = user.flowManager;
  const { gitSyncPage } = user.pageManager;

  const requestSettings = { renderRequestBody: true, encodeUrl: true, followRedirects: 'global', cookies: { send: true, store: true }, rebuildPath: true };
  const buildRequest = (id: string, name: string, url: string, extra: Record<string, unknown> = {}) => ({
    name,
    url,
    method: 'GET',
    meta: { id, created: 1000, modified: 1000, isPrivate: false },
    settings: requestSettings,
    ...extra,
  });
  const buildFolder = (id: string, name: string, children?: unknown[]) => ({ name, meta: { id, created: 1000, modified: 1000 }, children });
  const buildCollectionFile = (workspace: { id: string; name: string; environmentId: string }, collection: unknown[]) =>
    JSON.stringify(
      {
        type: 'collection.insomnia.rest/5.0',
        schema_version: '5.1',
        name: workspace.name,
        meta: { id: workspace.id, created: 1000, modified: 1000 },
        collection,
        environments: { name: 'Base Environment', meta: { id: workspace.environmentId, created: 1000, modified: 1000, isPrivate: false } },
      },
      null,
      2,
    );

  const workspace = { id: `wrk_${faker.string.alphanumeric({ length: 16, casing: 'lower' })}`, name: faker.string.alpha(10), environmentId: `env_${faker.string.alphanumeric({ length: 16, casing: 'lower' })}` };
  const folder = { id: `fld_${faker.string.alphanumeric({ length: 16, casing: 'lower' })}`, name: faker.string.alpha(10) };
  const children = [
    { id: `req_${faker.string.alphanumeric({ length: 16, casing: 'lower' })}`, name: faker.string.alpha(10) },
    { id: `req_${faker.string.alphanumeric({ length: 16, casing: 'lower' })}`, name: faker.string.alpha(10) },
  ];
  const fileName = `${faker.string.alpha(10).toLowerCase()}.yaml`;
  const seedFiles: Record<string, string> = {
    [fileName]: buildCollectionFile(workspace, [
      buildFolder(
        folder.id,
        folder.name,
        children.map((child, index) => buildRequest(child.id, child.name, `https://example.com/${index}`)),
      ),
    ]),
  };
  for (const [filePath, content] of Object.entries(seedFiles)) {
    await pushServerFile({ path: filePath, content });
  }
  await preferencesFlow.addGitCredential(GIT_CREDENTIAL);
  const cloneParentDir = fs.mkdtempSync(path.join(os.tmpdir(), 'insomnia-visual-diff-'));
  await workspaceFlow.create(new Project(faker.string.alphanumeric(10), ProjectType.Git), GIT_CREDENTIAL.name, { cloneParentDir });
  const cloneDir = path.join(cloneParentDir, fs.readdirSync(cloneParentDir)[0]);
  fs.writeFileSync(path.join(cloneDir, fileName), buildCollectionFile(workspace, []));
  await expect.poll(async () => gitSyncPage.hasUncommittedChanges(), { timeout: DEFAULT_TIMEOUT }).toBe(true);
  const count = (text: string) => ({
    folders: text.split(folder.id).length - 1,
    requests: children.map(child => text.split(child.id).length - 1),
  });

  await gitSyncFlow.stageEntity(fileName, folder.name);
  await gitSyncFlow.openVisualDiff(GitChangeList.Staged, fileName);
  const stagedAfterStage = await gitSyncPage.getEntityCardNames();
  const stagedStatuses = [
    await gitSyncPage.getEntityCardText(folder.name),
    await gitSyncPage.getEntityCardText(children[0].name),
    await gitSyncPage.getEntityCardText(children[1].name),
  ].map(text => text.includes('Removed'));
  await gitSyncFlow.unstageEntity(fileName, folder.name);
  const stagedAfterUnstageFolder = await gitSyncPage.getEntityCardNames();
  const indexAfterUnstageFolder = count(execSync(`git show :${fileName}`, { cwd: cloneDir, encoding: 'utf8' }));
  await gitSyncFlow.discardEntity(fileName, folder.name);
  const fileAfterDiscardFolder = count(fs.readFileSync(path.join(cloneDir, fileName), 'utf8'));
  for (const child of children) {
    await gitSyncFlow.unstageEntity(fileName, child.name);
  }
  const indexAfterUnstageChildren = count(execSync(`git show :${fileName}`, { cwd: cloneDir, encoding: 'utf8' }));
  for (const child of children) {
    await gitSyncFlow.discardEntity(fileName, child.name);
  }
  const restoredFile = fs.readFileSync(path.join(cloneDir, fileName), 'utf8');

  expect(stagedAfterStage.sort()).toEqual([folder.name, ...children.map(child => child.name)].sort());
  expect(stagedStatuses).toEqual([true, true, true]);
  expect(stagedAfterUnstageFolder.sort()).toEqual(children.map(child => child.name).sort());
  expect(indexAfterUnstageFolder).toEqual({ folders: 1, requests: [0, 0] });
  expect(fileAfterDiscardFolder).toEqual({ folders: 1, requests: [0, 0] });
  expect(indexAfterUnstageChildren).toEqual({ folders: 1, requests: [1, 1] });
  expect(count(restoredFile)).toEqual({ folders: 1, requests: [1, 1] });
  expect(restoredFile.indexOf(folder.id)).toBeLessThan(restoredFile.indexOf(children[0].id));
  expect(restoredFile).toContain('children:');
});
