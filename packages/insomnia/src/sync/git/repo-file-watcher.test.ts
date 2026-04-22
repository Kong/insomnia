import fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { dbMock, servicesMock, getInsomniaV5DataExportMock } = vi.hoisted(() => ({
  dbMock: {
    find: vi.fn(),
    findOne: vi.fn(),
    onChange: vi.fn(),
    bufferChanges: vi.fn(),
    flushChanges: vi.fn(),
    update: vi.fn(),
    getWithDescendants: vi.fn(),
    unsafeRemove: vi.fn(),
  },
  servicesMock: {
    workspace: {
      getById: vi.fn(),
    },
    workspaceMeta: {
      getOrCreateByParentId: vi.fn(),
      update: vi.fn(),
    },
  },
  getInsomniaV5DataExportMock: vi.fn(),
}));

vi.mock('electron', () => ({
  BrowserWindow: {
    getAllWindows: () => [],
  },
}));

vi.mock('~/insomnia-data', () => ({
  models: {
    workspace: {
      type: 'workspace',
      isWorkspace: (doc: { type?: string }) => doc.type === 'workspace',
    },
    workspaceMeta: {
      type: 'workspaceMeta',
    },
  },
  services: servicesMock,
}));

vi.mock('../../common/database', () => ({
  database: dbMock,
}));

vi.mock('../../common/import-v5-parser', () => ({
  InsomniaFileTypeValues: ['_type: export'],
}));

vi.mock('../../common/insomnia-v5', () => ({
  getInsomniaV5DataExport: getInsomniaV5DataExportMock,
  tryImportV5Data: vi.fn(),
}));

vi.mock('../../models', () => ({
  canSync: () => true,
}));

import { type FileIssue, RepoFileWatcher } from './repo-file-watcher';

describe('RepoFileWatcher', () => {
  const notifier = {
    onDbSynced: vi.fn(),
    onProblemsChanged: vi.fn(),
  };

  let repoDir: string;
  let filePath: string;

  beforeEach(async () => {
    vi.clearAllMocks();

    repoDir = await fs.mkdtemp(path.join(tmpdir(), 'repo-file-watcher-'));
    filePath = path.join(repoDir, 'workspace.yaml');

    dbMock.find.mockResolvedValue([
      {
        _id: 'ws_1',
        type: 'workspace',
        parentId: 'project_1',
      },
    ]);
    dbMock.findOne.mockResolvedValue({
      parentId: 'ws_1',
      gitFilePath: 'workspace.yaml',
    });
    getInsomniaV5DataExportMock.mockResolvedValue('db-version');
  });

  afterEach(async () => {
    await fs.rm(repoDir, { recursive: true, force: true });
  });

  it('does not overwrite a file that is currently marked as a problem during flushNow()', async () => {
    const conflictContent = ['_type: export', '<<<<<<< ours', 'broken'].join('\n');
    await fs.writeFile(filePath, conflictContent, 'utf8');

    const watcher = new (RepoFileWatcher as any)(repoDir, 'project_1', notifier) as RepoFileWatcher;
    const issue: FileIssue = {
      filePath,
      relPath: 'workspace.yaml',
      kind: 'conflict',
      message: 'conflict markers present',
    };
    (watcher as any).problemFiles.set(path.normalize(filePath), issue);

    await watcher.flushNow();

    expect(await fs.readFile(filePath, 'utf8')).toBe(conflictContent);
    expect(getInsomniaV5DataExportMock).not.toHaveBeenCalled();
  });

  it('still flushes clean files when no problem is tracked', async () => {
    await fs.writeFile(filePath, '_type: export\nold-version', 'utf8');

    const watcher = new (RepoFileWatcher as any)(repoDir, 'project_1', notifier) as RepoFileWatcher;

    await watcher.flushNow();

    expect(await fs.readFile(filePath, 'utf8')).toBe('db-version');
    expect(getInsomniaV5DataExportMock).toHaveBeenCalledWith({
      workspaceId: 'ws_1',
      includePrivateEnvironments: false,
    });
  });
});
