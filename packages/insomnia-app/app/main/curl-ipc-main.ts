import { ipcMain } from 'electron';

import { CurlRequestEvent } from '../common/ipc-events';
import type { RenderedRequest } from '../common/render';
import type { Environment } from '../models/environment';
import type { Workspace } from '../models/workspace';
import { _actuallySend, cancelRequestById } from '../network/curl';
import type { ResponsePatch } from '../network/network';

export function init() {
  ipcMain.handle(CurlRequestEvent.send, async (_, renderedRequest: RenderedRequest, workspace: Workspace, settings, environment: Environment | null, validateSSL: boolean): Promise<ResponsePatch> => {
    return _actuallySend(renderedRequest, workspace, settings, environment, validateSSL);
  });

  ipcMain.on(CurlRequestEvent.cancel, (_, requestId: string): void => {
    cancelRequestById(requestId);
  });
}
