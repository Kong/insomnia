import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UserAbortResolveMergeConflictError } from '../errors';

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

  it('registers the merge conflict listener once', async () => {
    const on = vi.fn(() => () => {});

    global.window = {
      main: {
        sync: {
          on,
          resolveConflict: vi.fn(),
          cancelConflict: vi.fn(),
        },
      },
    } as Window & typeof globalThis;

    const { registerSyncMergeConflictListener } = await import('../insomnia-sync');

    registerSyncMergeConflictListener();
    registerSyncMergeConflictListener();
    expect(on).toHaveBeenCalledWith('sync.merge-conflicts', expect.any(Function));
    expect(on).toHaveBeenCalledTimes(1);
  });

  it('routes merge conflict modal callbacks back through the sync bridge', async () => {
    const resolveConflict = vi.fn();
    const cancelConflict = vi.fn();
    const on = vi.fn((_channel, listener) => {
      listener(undefined, {
        requestId: 'req_123',
        conflicts: [{ key: 'doc_1' }],
        labels: { ours: 'ours', theirs: 'theirs' },
      });

      return () => {};
    });

    global.window = {
      main: {
        sync: {
          on,
          resolveConflict,
          cancelConflict,
        },
      },
    } as Window & typeof globalThis;

    const { showModal } = await import('../../../ui/components/modals');
    const { registerSyncMergeConflictListener } = await import('../insomnia-sync');

    registerSyncMergeConflictListener();

    expect(showModal).toHaveBeenCalledWith(expect.anything(), {
      conflicts: [{ key: 'doc_1' }],
      labels: { ours: 'ours', theirs: 'theirs' },
      onResolveAll: expect.any(Function),
      onCancelUnresolved: expect.any(Function),
    });

    const modalOptions = vi.mocked(showModal).mock.calls[0][1];
    modalOptions.onResolveAll([{ key: 'doc_2' }]);
    modalOptions.onCancelUnresolved();

    expect(resolveConflict).toHaveBeenCalledWith({ requestId: 'req_123', conflicts: [{ key: 'doc_2' }] });
    expect(cancelConflict).toHaveBeenCalledWith({ requestId: 'req_123' });
  });

  it('exports the renderer abort error class', async () => {
    const { UserAbortResolveMergeConflictError: ExportedError } = await import('../insomnia-sync');

    expect(new ExportedError().name).toBe(new UserAbortResolveMergeConflictError().name);
  });
});
