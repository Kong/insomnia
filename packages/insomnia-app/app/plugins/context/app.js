// @flow
import * as React from 'react';
import * as electron from 'electron';
import { showAlert, showModal, showPrompt } from '../../ui/components/modals';
import type { RenderPurpose } from '../../common/render';
import {
  RENDER_PURPOSE_GENERAL,
  RENDER_PURPOSE_NO_RENDER,
  RENDER_PURPOSE_SEND,
} from '../../common/render';
import WrapperModal from '../../ui/components/modals/wrapper-modal';
import HtmlElementWrapper from '../../ui/components/html-element-wrapper';
import { axiosRequest as axios } from '../../../app/network/axios-request';
import * as analytics from '../../../app/common/analytics';

export function init(renderPurpose: RenderPurpose = RENDER_PURPOSE_GENERAL): { app: Object } {
  const canShowDialogs =
    renderPurpose === RENDER_PURPOSE_SEND || renderPurpose === RENDER_PURPOSE_NO_RENDER;

  return {
    app: {
      alert(title: string, message?: string): Promise<void> {
        if (!canShowDialogs) {
          return Promise.resolve();
        }

        return showAlert({ title, message });
      },
      dialog(
        title,
        body: HTMLElement,
        options?: {
          onHide?: () => void,
          tall?: boolean,
          skinny?: boolean,
          wide?: boolean,
        } = {},
      ): void {
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
          label?: string,
          defaultValue?: string,
          submitName?: string,
          cancelable?: boolean,
        },
      ): Promise<string> {
        options = options || {};

        if (!canShowDialogs) {
          return Promise.resolve(options.defaultValue || '');
        }

        return new Promise((resolve, reject) => {
          showPrompt({
            title,
            ...(options || {}: Object),
            onCancel() {
              reject(new Error(`Prompt ${title} cancelled`));
            },
            onComplete(value: string) {
              resolve(value);
            },
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
      async showSaveDialog(options: { defaultPath?: string } = {}): Promise<string | null> {
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

      // ~~~~~~~~~~~~~~~~~~ //
      // Deprecated Methods //
      // ~~~~~~~~~~~~~~~~~~ //

      /** @deprecated as it was never officially supported */
      showGenericModalDialog(title: string, options?: { html: string } = {}): void {
        console.warn('app.showGenericModalDialog() is deprecated. Use app.dialog() instead.');

        // Create DOM node so we can adapt to the new dialog() method
        const body = document.createElement('div');
        body.innerHTML = options.html;

        return this.dialog(title, body);
      },
    },
    __private: {
      axios,
      analytics,
    },
  };
}
