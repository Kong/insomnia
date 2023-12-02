import { BrowserWindow, ipcMain } from 'electron';

// registerUtilityProcessPort broadcasts message ports to observer windows
export function registerUtilityProcessConsumer(consumerWindows: BrowserWindow[]) {
    ipcMain.on('ipc://main/publish-port', ev => {
        consumerWindows.forEach(win => {
            win.webContents.postMessage('ipc://renderers/publish-port', null, ev.ports);
        });
    });
}
