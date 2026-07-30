import { oauthLoginToDevPortal } from '~/main/ipc/dev-portal/dev-portal-oauth';

import { ipcMainHandle } from '../electron';

export interface devPortalBridgeAPI {
  oauthLogin: typeof oauthLoginToDevPortal;
}

export function registerDevPortalHandlers() {
  ipcMainHandle('devPortal.oauthLogin', (_, options: Parameters<typeof oauthLoginToDevPortal>[0]) =>
    oauthLoginToDevPortal(options),
  );
}
