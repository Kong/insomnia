// @flow
import * as electron from 'electron';
import { showAlert, showPrompt } from '../../ui/components/modals/index';
import type { RenderPurpose } from '../../common/render';
import {
  RENDER_PURPOSE_GENERAL,
  RENDER_PURPOSE_SEND
} from '../../common/render';

export function init(
  renderPurpose: RenderPurpose = RENDER_PURPOSE_GENERAL
): { app: Object } {
  return {
    app: {
      alert(title: string, message?: string): Promise<void> {
        if (renderPurpose !== RENDER_PURPOSE_SEND) {
          return Promise.resolve();
        }

        return showAlert({ title, message });
      },
      prompt(
        title: string,
        options?: {
          label?: string,
          defaultValue?: string,
          submitName?: string,
          cancelable?: boolean
        }
      ): Promise<string> {
        options = options || {};

        if (renderPurpose !== RENDER_PURPOSE_SEND) {
          return Promise.resolve(options.defaultValue || '');
        }

        return new Promise((resolve, reject) => {
          showPrompt({
            title,
            ...(options || {}),
            onCancel() {
              reject(new Error(`Prompt ${title} cancelled`));
            },
            onComplete(value: string) {
              resolve(value);
            }
          });
        });
      },
      getPath(name: string): string {
        switch (name.toLowerCase()) {
          case 'desktop':
            return electron.remote.app.getPath('desktop');
          default:
            throw new Error(`Unknown path name ${name}`);
        }
      },
      async showSaveDialog(
        options: { defaultPath?: string } = {}
      ): Promise<string | null> {
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
