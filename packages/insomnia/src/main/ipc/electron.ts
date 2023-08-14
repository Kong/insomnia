import type { MenuItemConstructorOptions, OpenDialogOptions, SaveDialogOptions } from 'electron';
import { app, BrowserWindow, clipboard, dialog, ipcMain, Menu, shell } from 'electron';

import { fnOrString } from '../../common/misc';
import { localTemplateTags } from '../../ui/components/templating/local-template-tags';

export function registerElectronHandlers() {
  ipcMain.on('show-context-menu', event => {
    try {
    const template: MenuItemConstructorOptions[] = [
      {
        role: 'cut',
      },
      {
        role: 'copy',
      },
      {
        role: 'paste',
      },
      { type: 'separator' },
      ...localTemplateTags.map(l => {
        const hasSubmenu = l.templateTag.args?.[0]?.options?.length;
        const r = {
          label: fnOrString(l.templateTag.displayName),
          ...(hasSubmenu ? {} : {
            click: () => {
              event.sender.send('context-menu-command', l.templateTag.displayName);
            },
          }),
          ...(hasSubmenu ? {
            submenu: l.templateTag.args?.[0]?.options?.map(s => ({
              label: fnOrString(s.displayName),
              click: () => {
                event.sender.send('context-menu-command', s.displayName);
              },
            })),
          } : {}),
        };
        return r;
      }),

    ];
    const menu = Menu.buildFromTemplate(template);
    menu.popup({ window: BrowserWindow.fromWebContents(event.sender) });
    } catch (e) {
      console.error(e);
    }
  });
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

  ipcMain.on('readText', event => {
    event.returnValue = clipboard.readText();
  });

  ipcMain.on('writeText', (_, text: string) => {
    clipboard.writeText(text);
  });

  ipcMain.on('clear', () => {
    clipboard.clear();
  });

  ipcMain.on('getPath', (event, name: Parameters<typeof Electron.app['getPath']>[0]) => {
    event.returnValue = app.getPath(name);
  });

  ipcMain.on('getAppPath', event => {
    event.returnValue = app.getAppPath();
  });
}
