import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchAndCacheOrganizationStorageRule } from '~/common/organization-storage-rules';
import { models, services } from '~/insomnia-data';
import { getMainVCS } from '~/main/cloud-sync/vcs';
import {
  initializeLocalBackendProjectAndMarkForSync,
  pushSnapshotOnInitialize,
} from '~/sync/vcs/initialize-backend-project';

import { initializeWorkspaceBackendProject, syncNewWorkspaceIfNeeded } from '../cloud-sync/initialization';

vi.mock('~/common/organization-storage-rules', () => ({
  fetchAndCacheOrganizationStorageRule: vi.fn(),
}));

vi.mock('~/insomnia-data', () => ({
  services: {
    workspace: {
      getById: vi.fn(),
    },
    project: {
      getById: vi.fn(),
    },
    userSession: {
      getOrCreate: vi.fn(),
    },
    workspaceMeta: {
      getOrCreateByParentId: vi.fn(),
    },
    environment: {
      getOrCreateForParentId: vi.fn(),
    },
    cookieJar: {
      getOrCreateForParentId: vi.fn(),
    },
  },
  models: {
    project: {
      isRemoteProject: vi.fn(),
    },
  },
}));

vi.mock('~/main/cloud-sync/vcs', () => ({
  getMainVCS: vi.fn(),
}));

vi.mock('~/sync/vcs/initialize-backend-project', () => ({
  initializeLocalBackendProjectAndMarkForSync: vi.fn(),
  pushSnapshotOnInitialize: vi.fn(),
}));

describe('sync-initialization', () => {
  const mockVcs = { id: 'mock-vcs' } as any;
  const workspace = {
    _id: 'wrk_123',
    parentId: 'proj_123',
    name: 'My Workspace',
  } as any;
  const project = {
    _id: 'proj_123',
    parentId: 'org_123',
    remoteId: 'remote_proj_123',
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(services.workspace.getById).mockResolvedValue(workspace);
    vi.mocked(services.project.getById).mockResolvedValue(project);
    vi.mocked(services.userSession.getOrCreate).mockResolvedValue({ id: 'sess_123' } as any);
    vi.mocked(services.workspaceMeta.getOrCreateByParentId).mockResolvedValue({ gitRepositoryId: null } as any);
    vi.mocked(services.environment.getOrCreateForParentId).mockResolvedValue({} as any);
    vi.mocked(services.cookieJar.getOrCreateForParentId).mockResolvedValue({} as any);
    vi.mocked(models.project.isRemoteProject).mockReturnValue(true);
    vi.mocked(fetchAndCacheOrganizationStorageRule).mockResolvedValue({
      enableCloudSync: true,
    } as any);
    vi.mocked(getMainVCS).mockReturnValue(mockVcs);
    vi.mocked(initializeLocalBackendProjectAndMarkForSync).mockResolvedValue();
    vi.mocked(pushSnapshotOnInitialize).mockResolvedValue();
  });

  it('returns early when initializing a workspace backend project without a session', async () => {
    vi.mocked(services.userSession.getOrCreate).mockResolvedValue({ id: null } as any);

    await initializeWorkspaceBackendProject({ workspaceId: workspace._id });

    expect(services.workspaceMeta.getOrCreateByParentId).not.toHaveBeenCalled();
    expect(getMainVCS).not.toHaveBeenCalled();
    expect(initializeLocalBackendProjectAndMarkForSync).not.toHaveBeenCalled();
  });

  it('skips workspace backend initialization when the workspace already has git metadata', async () => {
    vi.mocked(services.workspaceMeta.getOrCreateByParentId).mockResolvedValue({ gitRepositoryId: 'git_123' } as any);

    await initializeWorkspaceBackendProject({ workspaceId: workspace._id });

    expect(getMainVCS).not.toHaveBeenCalled();
    expect(initializeLocalBackendProjectAndMarkForSync).not.toHaveBeenCalled();
  });

  it('skips syncing a new workspace when the project is not remote', async () => {
    vi.mocked(models.project.isRemoteProject).mockReturnValue(false);

    await syncNewWorkspaceIfNeeded({ workspaceId: workspace._id });

    expect(fetchAndCacheOrganizationStorageRule).not.toHaveBeenCalled();
    expect(getMainVCS).not.toHaveBeenCalled();
    expect(initializeLocalBackendProjectAndMarkForSync).not.toHaveBeenCalled();
    expect(pushSnapshotOnInitialize).not.toHaveBeenCalled();
  });

  it('skips syncing a new workspace when cloud sync is disabled', async () => {
    vi.mocked(fetchAndCacheOrganizationStorageRule).mockResolvedValue({
      enableCloudSync: false,
    } as any);

    await syncNewWorkspaceIfNeeded({ workspaceId: workspace._id });

    expect(services.environment.getOrCreateForParentId).not.toHaveBeenCalled();
    expect(services.cookieJar.getOrCreateForParentId).not.toHaveBeenCalled();
    expect(getMainVCS).not.toHaveBeenCalled();
    expect(initializeLocalBackendProjectAndMarkForSync).not.toHaveBeenCalled();
    expect(pushSnapshotOnInitialize).not.toHaveBeenCalled();
  });

  it('initializes and pushes a new workspace for cloud sync-enabled remote projects', async () => {
    await syncNewWorkspaceIfNeeded({ workspaceId: workspace._id });

    expect(services.environment.getOrCreateForParentId).toHaveBeenCalledWith(workspace._id);
    expect(services.cookieJar.getOrCreateForParentId).toHaveBeenCalledWith(workspace._id);
    expect(services.workspaceMeta.getOrCreateByParentId).toHaveBeenCalledWith(workspace._id);
    expect(getMainVCS).toHaveBeenCalled();
    expect(initializeLocalBackendProjectAndMarkForSync).toHaveBeenCalledWith({
      vcs: mockVcs,
      workspace,
    });
    expect(pushSnapshotOnInitialize).toHaveBeenCalledWith({
      vcs: mockVcs,
      workspace,
      project,
    });
  });

  it('logs and swallows sync initialization failures so callers can continue', async () => {
    vi.mocked(initializeLocalBackendProjectAndMarkForSync).mockRejectedValue(new Error('boom'));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(syncNewWorkspaceIfNeeded({ workspaceId: workspace._id })).resolves.toBeUndefined();

    expect(warnSpy).toHaveBeenCalledWith(
      `Failed to initialize sync to insomnia cloud for workspace ${workspace._id}. This will be retried when the workspace is opened on the app. boom`,
    );
  });
});
