import type { OpenDialogOptions, SaveDialogOptions } from 'electron';
import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';

export function registerElectronHandlers() {
  ipcMain.on('setMenuBarVisibility', (_, visible: boolean) => {
    BrowserWindow.getAllWindows()
      .forEach(window => {
      // the `setMenuBarVisibility` signature uses `visible` semantics
        window.setMenuBarVisibility(visible);
        // the `setAutoHideMenu` signature uses `hide` semantics
        const hide = !visible;
        window.setAutoHideMenuBar(hide);
      });
  });
  ipcMain.handle('showOpenDialog', async (_, options: OpenDialogOptions) => {
    const { filePaths, canceled } = await dialog.showOpenDialog(options);
    return { filePaths, canceled };
  });

  ipcMain.handle('showSaveDialog', async (_, options: SaveDialogOptions) => {
    const { filePath, canceled } = await dialog.showSaveDialog(options);
    return { filePath, canceled };
  });

  ipcMain.on('showItemInFolder', (_, name: string) => {
    shell.showItemInFolder(name);
  });

  ipcMain.on('getPath', (event, name: Parameters<typeof Electron.app['getPath']>[0]) => {
    event.returnValue = app.getPath(name);
  });

  ipcMain.on('getAppPath', event => {
    event.returnValue = app.getAppPath();
  });
}
