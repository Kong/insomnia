import { BrowserWindow, ipcMain } from 'electron';

import { createUtilityProcess } from '../window-utils';

export interface UtilityProcessAPI {
    start: () => void;
}

// registerUtilityProcessPort broadcasts message ports to observer windows
export function registerUtilityProcessConsumer(consumerWindows: BrowserWindow[]) {
    ipcMain.on('ipc://main/publish-port', ev => {
        consumerWindows.forEach(win => {
            win.webContents.postMessage('ipc://renderers/publish-port', null, ev.ports);
        });
    });
}

export function registerUtilityProcessController() {
    ipcMain.handle('ipc://main/utility-process/start', () => {
        createUtilityProcess();
    });
}
