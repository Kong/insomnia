import { BrowserWindow, ipcMain } from 'electron';

import { createHiddenBrowserWindow, stopHiddenBrowserWindow } from '../window-utils';

export interface HiddenBrowserWindowAPI {
    start: () => void;
    stop: () => void;
}

// registerHiddenBrowserWindowConsumer broadcasts message ports to observer windows
export function registerHiddenBrowserWindowConsumer(consumerWindows: BrowserWindow[]) {
    ipcMain.on('ipc://main/publish-port', ev => {
        consumerWindows.forEach(win => {
            win.webContents.postMessage('ipc://renderers/publish-port', null, ev.ports);
        });
        console.log('[main][init hidden win step 5/6]: the main.js handed message port over to the main renderer');
    });
}

export function registerHiddenBrowserWindowController() {
    ipcMain.handle('ipc://main/hidden-browser-window/start', async () => {
        await createHiddenBrowserWindow();
    });
    ipcMain.handle('ipc://main/hidden-browser-window/stop', () => {
        stopHiddenBrowserWindow();
    });
}
