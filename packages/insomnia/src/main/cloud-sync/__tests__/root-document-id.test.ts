import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { BackendProject } from '../../../sync/types';
import FileSystemDriver from '../core/store/drivers/file-system-driver';
import { VCS } from '../core/vcs';

const workspaceList = vi.fn();
const workspaceGetById = vi.fn();
const createdVCS = vi.fn();

vi.mock('electron', () => ({
  app: { getPath: () => '/tmp/insomnia-test' },
}));

vi.mock('~/main/analytics', () => ({
  AnalyticsEvent: { vcsAction: 'VCS Action Executed' },
  trackAnalyticsEvent: vi.fn(),
}));

vi.mock('insomnia-data', () => ({
  models: {
    // Also consumed by sync/ignore-keys.ts, which runs while hashing documents into a snapshot.
    workspace: {
      isWorkspaceId: (id?: string | null) => Boolean(id?.startsWith('wrk_')),
      isWorkspace: (doc: { type: string }) => doc.type === 'Workspace',
    },
    projectLintRuleset: {
      isProjectLintRuleset: (doc: { type: string }) => doc.type === 'ProjectLintRuleset',
    },
  },
  services: {
    workspace: {
      list: (...args: unknown[]) => workspaceList(...args),
      getById: (...args: unknown[]) => workspaceGetById(...args),
    },
  },
}));

vi.mock('~/main/cloud-sync/create-vcs', () => ({
  createVCS: () => createdVCS(),
}));

const { reconcileBackendProjectRootDocumentId, repairLocalBackendProjectRootDocuments } = await import(
  '../root-document-id'
);

/**
 * A VCS holding one backend project whose single snapshot contains `workspaceId`.
 *
 * Backed by the filesystem driver rather than the in-memory one: `_allBackendProjects` derives
 * project ids from a non-recursive key listing, which only yields directory names on a real
 * filesystem, so `localBackendProjects` returns nothing under MemoryDriver.
 */
const vcsWithSnapshotFor = async (workspaceId: string) => {
  const vcs = new VCS(FileSystemDriver.create(mkdtempSync(path.join(tmpdir(), 'insomnia-vcs-'))));
  await vcs.switchAndCreateBackendProjectIfNotExist(workspaceId, 'My first collection');

  const status = await vcs.status([
    {
      key: workspaceId,
      name: 'My first collection',
      document: { _id: workspaceId, type: 'Workspace', parentId: null, name: 'My first collection' } as never,
    },
  ]);
  await vcs.stage(Object.values(status.unstaged));
  await vcs.takeSnapshot('Initial Snapshot');

  const [backendProject] = await vcs.localBackendProjects();
  return { vcs, backendProject };
};

/** Point the stored metadata at a workspace that is not the one inside the snapshot. */
const breakRootDocumentId = async (vcs: VCS, backendProject: BackendProject, staleRoot: string) => {
  await vcs.setBackendProject({ ...backendProject, rootDocumentId: staleRoot });
};

describe('reconcileBackendProjectRootDocumentId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('leaves matching metadata untouched', async () => {
    const { vcs, backendProject } = await vcsWithSnapshotFor('wrk_real');
    const setBackendProject = vi.spyOn(vcs, 'setBackendProject');

    const result = await reconcileBackendProjectRootDocumentId({
      vcs,
      backendProject,
      workspaceId: 'wrk_real',
    });

    expect(setBackendProject).not.toHaveBeenCalled();
    expect(result).toEqual(backendProject);
  });

  it('rewrites rootDocumentId to the workspace found in the snapshot', async () => {
    const { vcs, backendProject } = await vcsWithSnapshotFor('wrk_real');
    await breakRootDocumentId(vcs, backendProject, 'wrk_stale');

    const result = await reconcileBackendProjectRootDocumentId({
      vcs,
      backendProject: { ...backendProject, rootDocumentId: 'wrk_stale' },
      workspaceId: 'wrk_real',
    });

    expect(result.rootDocumentId).toBe('wrk_real');
    // Persisted, not just returned.
    const [stored] = await vcs.localBackendProjects();
    expect(stored.rootDocumentId).toBe('wrk_real');
    // The backend project identity itself must never change.
    expect(stored.id).toBe(backendProject.id);
  });
});

describe('repairLocalBackendProjectRootDocuments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('repairs metadata whose declared root has no workspace but whose snapshot workspace exists', async () => {
    const { vcs, backendProject } = await vcsWithSnapshotFor('wrk_real');
    await breakRootDocumentId(vcs, backendProject, 'wrk_stale');
    createdVCS.mockReturnValue(vcs);
    // wrk_stale resolves to nothing...
    workspaceList.mockResolvedValue([]);
    // ...but the workspace named by the snapshot is present locally.
    workspaceGetById.mockResolvedValue({ _id: 'wrk_real' });

    const result = await repairLocalBackendProjectRootDocuments();

    expect(result).toHaveLength(1);
    expect(result[0].rootDocumentId).toBe('wrk_real');
    const [stored] = await vcs.localBackendProjects();
    expect(stored.rootDocumentId).toBe('wrk_real');
  });

  it('does nothing when the declared root already resolves', async () => {
    const { vcs, backendProject } = await vcsWithSnapshotFor('wrk_real');
    createdVCS.mockReturnValue(vcs);
    workspaceList.mockResolvedValue([{ _id: 'wrk_real' }]);

    const result = await repairLocalBackendProjectRootDocuments();

    expect(result[0]).toEqual(backendProject);
    expect(workspaceGetById).not.toHaveBeenCalled();
  });

  it('leaves a genuinely unpulled backend project alone', async () => {
    const { vcs, backendProject } = await vcsWithSnapshotFor('wrk_real');
    await breakRootDocumentId(vcs, backendProject, 'wrk_stale');
    createdVCS.mockReturnValue(vcs);
    workspaceList.mockResolvedValue([]);
    // Neither the declared root nor the snapshot workspace exists locally.
    workspaceGetById.mockResolvedValue(null);

    const result = await repairLocalBackendProjectRootDocuments();

    expect(result[0].rootDocumentId).toBe('wrk_stale');
    const [stored] = await vcs.localBackendProjects();
    expect(stored.rootDocumentId).toBe('wrk_stale');
  });
});
