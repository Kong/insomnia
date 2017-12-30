// @flow
import * as electron from 'electron';
import {showAlert} from '../../ui/components/modals/index';
import {showPrompt} from '../../ui/components/modals';
import {RENDER_PURPOSE_SEND} from '../../common/render';

export function init (renderPurpose?: string): {app: Object} {
  return {
    app: {
      alert (title: string, message?: string): Promise<void> {
        if (renderPurpose !== RENDER_PURPOSE_SEND) {
          return Promise.resolve();
        }

        return showAlert({title, message});
      },
      prompt (
        title: string,
        options: {
          label?: string,
          defaultValue?: string,
          submitName?: string
        }
      ): Promise<string> {
        options = options || {};

        if (renderPurpose !== RENDER_PURPOSE_SEND) {
          return Promise.resolve(options.defaultValue || '');
        }

        return new Promise(resolve => {
          showPrompt({
            title,
            ...(options || {}),
            cancelable: false,
            onComplete (value: string) {
              resolve(value);
            }
          });
        });
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
        if (renderPurpose !== RENDER_PURPOSE_SEND) {
          return Promise.resolve(null);
        }

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
      }
    }
  };
}
