// @flow
import type {Plugin} from '../';
import * as electron from 'electron';
import {showAlert} from '../../ui/components/modals/index';
import {importRaw, importUri} from '../../common/import';
import type {Workspace} from '../../models/workspace';

export function init (plugin: Plugin, activeWorkspace: Workspace): {app: Object} {
  if (!activeWorkspace) {
    throw new Error('contexts.app initialized without workspace');
  }

  return {
    app: {
      alert (message: string): Promise<void> {
        return showAlert({title: `Plugin ${plugin.name}`, message: message || ''});
      },
      getPath (name: string): string {
        switch (name.toLowerCase()) {
          case 'desktop':
            return electron.remote.app.getPath('desktop');
          default:
            throw new Error(`Unknown path name ${name}`);
        }
      },
      async showSaveDialog (options: {defaultPath?: string} = {}): Promise<string | null> {
        return new Promise(resolve => {
          const saveOptions = {
            title: 'Save File',
            buttonLabel: 'Save',
            defaultPath: options.defaultPath
          };

          electron.remote.dialog.showSaveDialog(saveOptions, filename => {
            resolve(filename || null);
          });
        });
      },
      async importUri (uri: string, workspaceId: ?string): Promise<void> {
        if (!workspaceId) {
          await importUri(activeWorkspace._id, uri);
        } else {
          await importUri(workspaceId, uri);
        }
      },
      async importRaw (text: string, workspaceId: ?string): Promise<void> {
        if (!workspaceId) {
          await importRaw(activeWorkspace._id, text);
        } else {
          await importRaw(workspaceId, text);
        }
      }
    }
  };
}
