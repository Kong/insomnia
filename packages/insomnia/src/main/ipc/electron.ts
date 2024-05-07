import type { IpcMainEvent, IpcMainInvokeEvent, MenuItemConstructorOptions, OpenDialogOptions, SaveDialogOptions } from 'electron';
import { app, BrowserWindow, clipboard, dialog, ipcMain, Menu, shell } from 'electron';

import { fnOrString } from '../../common/misc';
import type { NunjucksParsedTagArg } from '../../templating/utils';
import { localTemplateTags } from '../../ui/components/templating/local-template-tags';
import { invariant } from '../../utils/invariant';

export type HandleChannels =
  'authorizeUserInWindow'
  | 'backup'
  | 'curl.event.findMany'
  | 'curl.open'
  | 'curl.readyState'
  | 'curlRequest'
  | 'database.caCertificate.create'
  | 'grpc.loadMethods'
  | 'grpc.loadMethodsFromReflection'
  | 'installPlugin'
  | 'open-channel-to-hidden-browser-window'
  | 'readCurlResponse'
  | 'restoreBackup'
  | 'showOpenDialog'
  | 'showSaveDialog'
  | 'spectralRun'
  | 'webSocket.event.findMany'
  | 'webSocket.event.send'
  | 'webSocket.open'
  | 'webSocket.readyState'
  | 'writeFile';

export const ipcMainHandle = (
  channel: HandleChannels,
  listener: (
    event: IpcMainInvokeEvent,
    ...args: any[]
  ) => Promise<void> | any
) => ipcMain.handle(channel, listener);
export type MainOnChannels =
  'cancelCurlRequest'
  | 'clear'
  | 'curl.close'
  | 'curl.closeAll'
  | 'getAppPath'
  | 'getPath'
  | 'grpc.cancel'
  | 'grpc.closeAll'
  | 'grpc.commit'
  | 'grpc.sendMessage'
  | 'grpc.start'
  | 'loginStateChange'
  | 'manualUpdateCheck'
  | 'openDeepLink'
  | 'openInBrowser'
  | 'readText'
  | 'restart'
  | 'set-hidden-window-busy-status'
  | 'setMenuBarVisibility'
  | 'show-context-menu'
  | 'showItemInFolder'
  | 'showOpenDialog'
  | 'showSaveDialog'
  | 'trackPageView'
  | 'trackSegmentEvent'
  | 'webSocket.close'
  | 'webSocket.closeAll'
  | 'writeText';
export type RendererOnChannels =
  'clear-all-models'
  | 'clear-model'
  | 'context-menu-command'
  | 'grpc.data'
  | 'grpc.end'
  | 'grpc.error'
  | 'grpc.start'
  | 'grpc.status'
  | 'loggedIn'
  | 'reload-plugins'
  | 'shell:open'
  | 'show-notification'
  | 'toggle-preferences-shortcuts'
  | 'toggle-preferences'
  | 'toggle-sidebar'
  | 'updaterStatus';
export const ipcMainOn = (
  channel: MainOnChannels,
  listener: (
    event: IpcMainEvent,
    ...args: any[]
  ) => Promise<void> | any
) => ipcMain.on(channel, listener);
export type OnceChannels = 'halfSecondAfterAppStart';
export const ipcMainOnce = (
  channel: OnceChannels,
  listener: (
    event: IpcMainEvent,
    ...args: any[]
  ) => Promise<void> | any
) => ipcMain.once(channel, listener);

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
  ipcMainOn('show-context-menu', (event, options) => {
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
  ipcMainOn('setMenuBarVisibility', (_, visible: boolean) => {
    BrowserWindow.getAllWindows()
      .forEach(window => {
        // the `setMenuBarVisibility` signature uses `visible` semantics
        window.setMenuBarVisibility(visible);
        // the `setAutoHideMenu` signature uses `hide` semantics
        const hide = !visible;
        window.setAutoHideMenuBar(hide);
      });
  });
  ipcMainHandle('showOpenDialog', async (_, options: OpenDialogOptions) => {
    const { filePaths, canceled } = await dialog.showOpenDialog(options);
    return { filePaths, canceled };
  });

  ipcMainHandle('showSaveDialog', async (_, options: SaveDialogOptions) => {
    const { filePath, canceled } = await dialog.showSaveDialog(options);
    return { filePath, canceled };
  });

  ipcMainOn('showItemInFolder', (_, name: string) => {
    shell.showItemInFolder(name);
  });

  ipcMainOn('readText', event => {
    event.returnValue = clipboard.readText();
  });

  ipcMainOn('writeText', (_, text: string) => {
    clipboard.writeText(text);
  });

  ipcMainOn('clear', () => {
    clipboard.clear();
  });

  ipcMainOn('getPath', (event, name: Parameters<typeof Electron.app['getPath']>[0]) => {
    event.returnValue = app.getPath(name);
  });

  ipcMainOn('getAppPath', event => {
    event.returnValue = app.getAppPath();
  });
}
