import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { services } from 'insomnia-data';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { database as db } from '../../../common/database';
import { getInsomniaV5DataExport } from '../../../common/insomnia-v5';
import { RepoFileWatcherRegistry } from '../repo-file-watcher';

const REPO_ID = 'git_repo_test';
const PROJECT_ID = 'proj_test';

// Builds a real exported collection (so the fixture always matches the current schema), then swaps in the given ids.
const collectionYaml = async ({ workspaceId, requestId, folderId }: { workspaceId: string; requestId: string; folderId: string }) => {
  const workspace = await services.workspace.create({ name: 'Imported', scope: 'collection', parentId: PROJECT_ID });
  await services.environment.getOrCreateForParentId(workspace._id);
  const folder = await services.requestGroup.create({ name: 'Folder', parentId: workspace._id });
  const request = await services.request.create({ name: 'Request', url: 'http://example.com', parentId: folder._id });
  const exported = (await getInsomniaV5DataExport({ workspaceId: workspace._id, includePrivateEnvironments: false })) as string;
  await db.init({ inMemoryOnly: true }, true);
  return exported
    .replaceAll(workspace._id, workspaceId)
    .replaceAll(folder._id, folderId)
    .replaceAll(request._id, requestId);
};

describe('RepoFileWatcher synced doc id validation', () => {
  let repoDir: string;
  let registry: RepoFileWatcherRegistry;

  beforeEach(async () => {
    await db.init({ inMemoryOnly: true }, true);
    repoDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'insomnia-repo-watcher-validation-'));
    registry = new RepoFileWatcherRegistry({ onDbSynced: vi.fn(), onProblemsChanged: vi.fn() });
  });

  afterEach(async () => {
    registry.stopAll();
    await fs.promises.rm(repoDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  const importYaml = async (yaml: string) => {
    await fs.promises.writeFile(path.join(repoDir, 'insomnia.collection.yaml'), yaml, 'utf8');
    await registry.startWatcher(REPO_ID, repoDir, PROJECT_ID);
  };

  it('imports a file with well-formed ids', async () => {
    await importYaml(await collectionYaml({ workspaceId: 'wrk_abc123', requestId: 'req_abc123', folderId: 'fld_abc123' }));

    expect(await services.workspace.getById('wrk_abc123')).toBeTruthy();
    expect(await db.findOne('Request', { _id: 'req_abc123' })).toBeTruthy();
    expect(registry.getProblems(REPO_ID)).toEqual([]);
  });

  it.each([
    ['workspace id', { workspaceId: 'wrk_../../../x', requestId: 'req_ok', folderId: 'fld_ok' }],
    ['request id', { workspaceId: 'wrk_ok', requestId: 'req_../../../x', folderId: 'fld_ok' }],
    ['folder id, which becomes the request parentId', { workspaceId: 'wrk_ok', requestId: 'req_ok', folderId: 'fld_../../x' }],
  ])('refuses the whole file and reports a problem for an unsafe %s', async (_label, ids) => {
    await importYaml(await collectionYaml(ids));

    expect(await services.workspace.getById('wrk_ok')).toBeFalsy();
    expect(await db.findOne('Request', { _id: 'req_ok' })).toBeFalsy();
    expect(await db.findOne('Request', { _id: 'req_../../../x' })).toBeFalsy();
    expect(await services.workspaceMeta.getByParentId('wrk_../../../x')).toBeFalsy();
    expect(registry.getProblems(REPO_ID)).toMatchObject([{ kind: 'parse-error', relPath: 'insomnia.collection.yaml' }]);
  });
});
