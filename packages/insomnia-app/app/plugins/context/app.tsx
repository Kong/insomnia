import * as electron from 'electron';
import React from 'react';

import * as analytics from '../../../app/common/analytics';
import { axiosRequest as axios } from '../../../app/network/axios-request';
import type { RenderPurpose } from '../../common/render';
import {
  RENDER_PURPOSE_GENERAL,
  RENDER_PURPOSE_NO_RENDER,
  RENDER_PURPOSE_SEND,
} from '../../common/render';
import HtmlElementWrapper from '../../ui/components/html-element-wrapper';
import { showAlert, showModal, showPrompt } from '../../ui/components/modals';
import WrapperModal from '../../ui/components/modals/wrapper-modal';

export function init(renderPurpose: RenderPurpose = RENDER_PURPOSE_GENERAL): {
  app: Record<string, any>;
} {
  const canShowDialogs =
    renderPurpose === RENDER_PURPOSE_SEND || renderPurpose === RENDER_PURPOSE_NO_RENDER;
  return {
    app: {
      alert(title: string, message?: string) {
        if (!canShowDialogs) {
          return Promise.resolve();
        }

        return showAlert({
          title,
          message,
        });
      },

      dialog(
        title,
        body: HTMLElement,
        options: {
          onHide?: () => void;
          tall?: boolean;
          skinny?: boolean;
          wide?: boolean;
        } = {},
      ) {
        if (renderPurpose !== RENDER_PURPOSE_SEND && renderPurpose !== RENDER_PURPOSE_NO_RENDER) {
          return;
        }

        showModal(WrapperModal, {
          title,
          body: <HtmlElementWrapper el={body} onUnmount={options.onHide} />,
          tall: options.tall,
          skinny: options.skinny,
          wide: options.wide,
        });
      },

      prompt(
        title: string,
        options?: {
          label?: string;
          defaultValue?: string;
          submitName?: string;
          cancelable?: boolean;
        },
      ) {
        options = options || {};

        if (!canShowDialogs) {
          return Promise.resolve(options.defaultValue || '');
        }

        // This custom promise converts the prompt modal from being callback-based to reject when the modal is cancelled and resolve when the modal is submitted and hidden
        return new Promise<string>((resolve, reject) => {
          let shouldResolve = false;
          let resolveWith: string | null = null;

          showPrompt({
            title,
            ...(options || ({} as Record<string, any>)),

            onCancel() {
              reject(new Error(`Prompt ${title} cancelled`));
            },

            onComplete(value: string) {
              shouldResolve = true;
              resolveWith = value;
            },

            // don't resolve the overall promise until the modal has hidden after clicking submit
            onHide() {
              if (shouldResolve && resolveWith !== null) {
                resolve(resolveWith);
              }
            },
          });
        });
      },

      getPath(name: string) {
        switch (name.toLowerCase()) {
          case 'desktop':
            return electron.remote.app.getPath('desktop');

          default:
            throw new Error(`Unknown path name ${name}`);
        }
      },

      async showSaveDialog(
        options: {
          defaultPath?: string;
        } = {},
      ): Promise<string | null> {
        if (!canShowDialogs) {
          return Promise.resolve(null);
        }

        const saveOptions = {
          title: 'Save File',
          buttonLabel: 'Save',
          defaultPath: options.defaultPath,
        };
        const { filePath } = await electron.remote.dialog.showSaveDialog(saveOptions);
        return filePath || null;
      },

      clipboard: {
        readText(): string {
          return electron.clipboard.readText();
        },

        writeText(text: string): void {
          electron.clipboard.writeText(text);
        },

        clear(): void {
          electron.clipboard.clear();
        },
      },

      // ~~~~~~~~~~~~~~~~~~ //
      // Deprecated Methods //
      // ~~~~~~~~~~~~~~~~~~ //

      /** @deprecated as it was never officially supported */
      showGenericModalDialog(
        title: string,
        options: {
          html?: string;
        } = {},
      ) {
        console.warn('app.showGenericModalDialog() is deprecated. Use app.dialog() instead.');
        // Create DOM node so we can adapt to the new dialog() method
        const body = document.createElement('div');
        // @ts-expect-error -- TSCONVERSION
        body.innerHTML = options.html;
        return this.dialog(title, body);
      },
    },
    // @ts-expect-error -- TSCONVERSION
    __private: {
      axios,
      analytics,
    },
  };
}
