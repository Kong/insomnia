import { oauthLoginToDevPortal } from '~/main/ipc/dev-portal/dev-portal-oauth';
import { syncDevPortal } from '~/main/ipc/dev-portal/sync';

import { ipcMainHandle, ipcMainOn } from '../electron';
import { isDevPortalFetchError } from './dev-portal-fetch';

// syncDevPortal's `signal`/`onProgress` can't cross the IPC boundary, so they're re-created here:
// progress is pushed back to the invoking window over a per-project channel, and cancellation is
// a second fire-and-forget call that aborts the controller tracked for that project.
type SyncOptions = Omit<Parameters<typeof syncDevPortal>[0], 'signal' | 'onProgress'>;
const syncAbortControllers = new Map<string, AbortController>();

export interface devPortalBridgeAPI {
  oauthLogin: typeof oauthLoginToDevPortal;
  sync: (options: SyncOptions) => ReturnType<typeof syncDevPortal>;
  cancelSync: (options: { projectId: string }) => void;
}

export function registerDevPortalHandlers() {
  ipcMainHandle('devPortal.oauthLogin', (_, options: Parameters<typeof oauthLoginToDevPortal>[0]) =>
    oauthLoginToDevPortal(options),
  );

  ipcMainHandle('devPortal.sync', async (event, options: SyncOptions) => {
    const { projectId } = options;
    const controller = new AbortController();
    syncAbortControllers.set(projectId, controller);
    try {
      return await syncDevPortal({
        ...options,
        signal: controller.signal,
        onProgress: message => event.sender.send(`devPortal.sync.progress.${projectId}`, message),
      });
    } finally {
      syncAbortControllers.delete(projectId);
    }
  });

  ipcMainOn('devPortal.cancelSync', (_, options: { projectId: string }) => {
    syncAbortControllers.get(options.projectId)?.abort();
  });
}
