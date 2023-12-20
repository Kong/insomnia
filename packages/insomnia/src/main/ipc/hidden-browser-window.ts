import { BrowserWindow, ipcMain } from 'electron';

import { createHiddenBrowserWindow } from '../window-utils';

export interface HiddenBrowserWindowAPI {
    start: () => void;
}

// registerHiddenBrowserWindowConsumer broadcasts message ports to observer windows
export function registerHiddenBrowserWindowConsumer(consumerWindows: BrowserWindow[]) {
    ipcMain.on('ipc://main/publish-port', ev => {
        consumerWindows.forEach(win => {
            win.webContents.postMessage('ipc://renderers/publish-port', null, ev.ports);
        });
    });
}

export function registerHiddenBrowserWindowController() {
    ipcMain.handle('ipc://main/hidden-browser-window/start', () => {
        createHiddenBrowserWindow();
    });
}
