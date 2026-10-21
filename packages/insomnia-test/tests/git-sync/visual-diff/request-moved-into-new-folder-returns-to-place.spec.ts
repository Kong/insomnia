import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { faker } from '@faker-js/faker';

import { GitChangeList } from '../../../enums/git-change-list';
import { ProjectType } from '../../../enums/project-types';
import { DEFAULT_TIMEOUT, expect, GIT_CREDENTIAL, pushServerFile,test } from '../../../misc/git-fixtures';
import { Project } from '../../../models/project';

test('Verify discarding a new folder a request moved into removes the request until it is restored to its original place', async ({ user }) => {
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
  const request = { id: `req_${faker.string.alphanumeric({ length: 16, casing: 'lower' })}`, name: faker.string.alpha(10) };
  const fileName = `${faker.string.alpha(10).toLowerCase()}.yaml`;
  const requestNode = () => buildRequest(request.id, request.name, 'https://example.com/moved');
  const original = buildCollectionFile(workspace, [requestNode()]);
  const seedFiles: Record<string, string> = { [fileName]: original };
  for (const [filePath, content] of Object.entries(seedFiles)) {
    await pushServerFile({ path: filePath, content });
  }
  await preferencesFlow.addGitCredential(GIT_CREDENTIAL);
  const cloneParentDir = fs.mkdtempSync(path.join(os.tmpdir(), 'insomnia-visual-diff-'));
  await workspaceFlow.create(new Project(faker.string.alphanumeric(10), ProjectType.Git), GIT_CREDENTIAL.name, { cloneParentDir });
  const cloneDir = path.join(cloneParentDir, fs.readdirSync(cloneParentDir)[0]);
  fs.writeFileSync(path.join(cloneDir, fileName), buildCollectionFile(workspace, [buildFolder(folder.id, folder.name, [requestNode()])]));
  await expect.poll(async () => gitSyncPage.hasUncommittedChanges(), { timeout: DEFAULT_TIMEOUT }).toBe(true);

  await gitSyncFlow.openVisualDiff(GitChangeList.Unstaged, fileName);
  const cardsBefore = await gitSyncPage.getEntityCardNames();
  await gitSyncFlow.stageEntity(fileName, folder.name);
  await gitSyncFlow.unstageEntity(fileName, folder.name);
  await gitSyncFlow.openVisualDiff(GitChangeList.Unstaged, fileName);
  await gitSyncPage.startEntityDiscard(folder.name);
  const confirmLabel = await gitSyncPage.getEntityDiscardConfirmLabel(folder.name);
  await gitSyncPage.confirmEntityDiscard(folder.name);
  const cardsAfterFolderDiscard = await gitSyncPage.getEntityCardNames();
  const requestCardText = await gitSyncPage.getEntityCardText(request.name);
  await gitSyncFlow.discardEntity(fileName, request.name);
  const restored = fs.readFileSync(path.join(cloneDir, fileName), 'utf8');

  expect(cardsBefore).toEqual([folder.name]);
  expect(confirmLabel).toBe('Confirm (discards its contents too)');
  expect(cardsAfterFolderDiscard).toEqual([request.name]);
  expect(requestCardText).toContain('Removed');
  expect(restored.split(request.id).length - 1).toBe(1);
  expect(restored.split(folder.id).length - 1).toBe(0);
});
