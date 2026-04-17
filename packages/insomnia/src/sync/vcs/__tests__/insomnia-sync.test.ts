import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../ui/components/modals', () => ({
  showModal: vi.fn(),
}));

vi.mock('../../../ui/components/modals/sync-merge-modal', () => ({
  SyncMergeModal: Symbol('SyncMergeModal'),
}));

describe('insomnia-sync', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('delegates VCS calls through the main sync bridge and keeps active backend project cached', async () => {
    const invoke = vi.fn(async methodName => {
      if (methodName === 'getActiveBackendProject') {
        return null;
      }

      return 'ok';
    });
    const on = vi.fn(() => () => {});

    global.window = {
      main: {
        sync: {
          invoke,
          on,
          resolveConflict: vi.fn(),
          cancelConflict: vi.fn(),
          pullRemoteBackendProject: vi.fn(),
        },
      },
    } as Window & typeof globalThis;

    const { VCSInstance } = await import('../insomnia-sync');
    const vcs = VCSInstance();
    const backendProject = { id: 'backend_1', rootDocumentId: 'wrk_1', name: 'Workspace 1' };

    await vcs.setBackendProject(backendProject as any);

    expect(on).toHaveBeenCalledWith('sync.merge-conflicts', expect.any(Function));
    expect(invoke).toHaveBeenCalledWith('setBackendProject', backendProject);
    expect(vcs.getActiveBackendProject()).toEqual(backendProject);
  });

  it('rethrows merge conflict cancellations as renderer-side abort errors', async () => {
    const on = vi.fn(() => () => {});

    global.window = {
      main: {
        sync: {
          invoke: vi.fn(async methodName => {
            if (methodName === 'getActiveBackendProject') {
              return null;
            }

            const error = new Error('User aborted merge');
            error.name = 'UserAbortResolveMergeConflictError';
            throw error;
          }),
          on,
          resolveConflict: vi.fn(),
          cancelConflict: vi.fn(),
          pullRemoteBackendProject: vi.fn(),
        },
      },
    } as Window & typeof globalThis;

    const { UserAbortResolveMergeConflictError, VCSInstance } = await import('../insomnia-sync');
    const vcs = VCSInstance();

    await expect(vcs.merge([], 'feature')).rejects.toBeInstanceOf(UserAbortResolveMergeConflictError);
  });
});
