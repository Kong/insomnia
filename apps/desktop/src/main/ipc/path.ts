import path from 'node:path';

import { ipcMainOn } from '~/main/ipc/electron';

export function registerPathHandlers() {
  ipcMainOn('path.basename', (event, p: string) => {
    event.returnValue = path.basename(p);
  });
  ipcMainOn('path.dirname', (event, p: string) => {
    event.returnValue = path.dirname(p);
  });
  ipcMainOn('path.join', (event, ...paths: string[]) => {
    event.returnValue = path.join(...paths);
  });
  ipcMainOn('path.resolve', (event, ...paths: string[]) => {
    event.returnValue = path.resolve(...paths);
  });
}
