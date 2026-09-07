import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UserAbortResolveMergeConflictError } from '~/sync/vcs/utils';

vi.mock('~/ui/components/modals', () => ({
  showModal: vi.fn(),
}));

vi.mock('~/ui/components/modals/sync-merge-modal', () => ({
  SyncMergeModal: Symbol('SyncMergeModal'),
}));

vi.mock('~/ui/ipc', () => ({
  sync: {
    resolveConflict: vi.fn(),
    cancelConflict: vi.fn(),
  },
}));

describe('insomnia-sync', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('registers the merge conflict listener once', async () => {
    const on = vi.fn(() => () => {});

    global.window = {
      main: {
        on,
      },
    } as unknown as Window & typeof globalThis;

    const { registerSyncMergeConflictListener } = await import('../insomnia-sync');

    registerSyncMergeConflictListener();
    registerSyncMergeConflictListener();
    expect(on).toHaveBeenCalledWith('sync.merge-conflicts', expect.any(Function));
    expect(on).toHaveBeenCalledTimes(1);
  });

  it('routes merge conflict modal callbacks back through the sync bridge', async () => {
    const on = vi.fn((_channel, listener) => {
      listener(undefined, {
        handlerId: 'req_123',
        conflicts: [{ key: 'doc_1' }],
        labels: { ours: 'ours', theirs: 'theirs' },
      });

      return () => {};
    });

    global.window = {
      main: {
        on,
      },
    } as unknown as Window & typeof globalThis;

    const { showModal } = await import('~/ui/components/modals');
    const { sync } = await import('~/ui/ipc');
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

    expect(sync.resolveConflict).toHaveBeenCalledWith({ handlerId: 'req_123', conflicts: [{ key: 'doc_2' }] });
    expect(sync.cancelConflict).toHaveBeenCalledWith({ handlerId: 'req_123' });
  });

  it('exports the renderer abort error class', async () => {
    const { UserAbortResolveMergeConflictError: ExportedError } = await import('../insomnia-sync');

    expect(new ExportedError().name).toBe(new UserAbortResolveMergeConflictError().name);
  });
});
