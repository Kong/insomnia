import type { MenuItemConstructorOptions, OpenDialogOptions, SaveDialogOptions } from 'electron';
import { app, BrowserWindow, clipboard, dialog, ipcMain, Menu, shell } from 'electron';

import { fnOrString } from '../../common/misc';
import type { NunjucksParsedTagArg } from '../../templating/utils';
import { localTemplateTags } from '../../ui/components/templating/local-template-tags';
import { invariant } from '../../utils/invariant';

const getTemplateValue = (arg: NunjucksParsedTagArg) => {
  if (arg.defaultValue === undefined) {
    return "''";
  }
  if (typeof arg.defaultValue === 'string') {
    return `'${arg.defaultValue}'`;
  }
  return arg.defaultValue;
};
export function registerElectronHandlers() {
  ipcMain.on('show-context-menu', (event, options) => {
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
        ...localTemplateTags
          // sort alphabetically
          .sort((a, b) => fnOrString(a.templateTag.displayName).localeCompare(fnOrString(b.templateTag.displayName)))
          .map(l => {
            const actions = l.templateTag.args?.[0];
            const additionalArgs = l.templateTag.args?.slice(1);
            const hasSubmenu = actions?.options?.length;
            return {
              label: fnOrString(l.templateTag.displayName),
              ...(!hasSubmenu ?
                {
                  click: () => {
                    const tag = `{% ${l.templateTag.name} ${l.templateTag.args?.map(getTemplateValue).join(', ')} %}`;
                    event.sender.send('context-menu-command', { key: options.key, tag });
                  },
                } :
                {
                  submenu: actions?.options?.map(action => ({
                    label: fnOrString(action.displayName),
                    click: () => {
                      const additionalTagFields = additionalArgs.length ? ', ' + additionalArgs.map(getTemplateValue).join(', ') : '';
                      const tag = `{% ${l.templateTag.name} '${action.value}'${additionalTagFields} %}`;
                      event.sender.send('context-menu-command', { key: options.key, tag });
                    },
                  })),
                }),
            };
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
