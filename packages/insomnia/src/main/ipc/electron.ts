import type { MenuItemConstructorOptions, OpenDialogOptions, SaveDialogOptions } from 'electron';
import { app, BrowserWindow, clipboard, dialog, ipcMain, Menu, shell } from 'electron';

import { fnOrString } from '../../common/misc';
import { localTemplateTags } from '../../ui/components/templating/local-template-tags';
import { invariant } from '../../utils/invariant';

export function registerElectronHandlers() {
  ipcMain.on('show-context-menu', (event, options) => {
    console.log('key', options.key);
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
          const actions = l.templateTag.args?.[0];
          const hasSubmenu = actions?.options?.length;
          const r = {
            label: fnOrString(l.templateTag.displayName),
            ...(hasSubmenu ? {} : {
              click: () => {
                const tag = `{% ${l.templateTag.name} 'encode', 'normal', '' %}`;
                event.sender.send('context-menu-command', { key: options.key, tag });
              },
            }),
            ...(hasSubmenu ? {
              submenu: actions?.options?.map(action => ({
                label: fnOrString(action.displayName),
                click: () => {
                  console.log(l.templateTag.args);
                  const tag = `{% ${l.templateTag.name} '${action.value}', 'normal', '' %}`;
                  event.sender.send('context-menu-command', { key: options.key, tag });
                },
              })),
            } : {}),
          };
          return r;
        }),

      ];
      const menu = Menu.buildFromTemplate(template);
      const win = BrowserWindow.fromWebContents(event.sender);
      invariant(win, 'expected window');
      menu.popup({ window: win });
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
