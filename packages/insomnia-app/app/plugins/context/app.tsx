import * as electron from 'electron';
import React from 'react';

import * as analytics from '../../../app/common/analytics';
import { axiosRequest as axios } from '../../../app/network/axios-request';
import { getAppPlatform, getAppVersion } from '../../common/constants';
import type { RenderPurpose } from '../../common/render';
import {
  RENDER_PURPOSE_GENERAL,
  RENDER_PURPOSE_NO_RENDER,
  RENDER_PURPOSE_SEND,
} from '../../common/render';
import { HtmlElementWrapper } from '../../ui/components/html-element-wrapper';
import { showAlert, showModal, showPrompt } from '../../ui/components/modals';
import { PromptModalOptions } from '../../ui/components/modals/prompt-modal';
import { WrapperModal } from '../../ui/components/modals/wrapper-modal';

interface DialogOptions {
  onHide?: () => void;
  tall?: boolean;
  skinny?: boolean;
  wide?: boolean;
}

interface AppInfo {
  version: string;
  platform: NodeJS.Platform;
}

interface ShowDialogOptions {
  defaultPath?: string;
}

interface AppClipboard {
  readText(): string;
  writeText(text: string): void;
  clear(): void;
}

interface ShowGenericModalDialogOptions {
  html?: string;
}

export interface AppContext {
  alert: (
    title: string,
    message?: string
  ) => Promise<undefined> | ReturnType<typeof showAlert>;
  dialog: (title: string, body: HTMLElement, options?: DialogOptions) => void;
  prompt: (title: string, options?: Pick<PromptModalOptions, 'label' | 'defaultValue' | 'submitName' | 'cancelable'>) => Promise<string>;
  getPath: (name: string) => string;
  getInfo: () => AppInfo;
  showSaveDialog: (options?: ShowDialogOptions) => Promise<string | null>;
  clipboard: AppClipboard;
  /**
   * @deprecated as it was never officially supported
   */
  showGenericModalDialog: (
    title: string,
    options?: ShowGenericModalDialogOptions
  ) => void;
}

export interface PrivateProperties {
  axios: typeof axios;
  analytics: typeof analytics;
}

export function init(renderPurpose: RenderPurpose = RENDER_PURPOSE_GENERAL): {
  app: AppContext;
  __private: PrivateProperties;
} {
  const canShowDialogs =
    renderPurpose === RENDER_PURPOSE_SEND ||
    renderPurpose === RENDER_PURPOSE_NO_RENDER;
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
        body,
        options = {},
      ) {
        if (
          renderPurpose !== RENDER_PURPOSE_SEND &&
          renderPurpose !== RENDER_PURPOSE_NO_RENDER
        ) {
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
        title,
        options = {},
      ) {
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

      getInfo() {
        return {
          version: getAppVersion(),
          platform: getAppPlatform(),
        };
      },

      async showSaveDialog(
        options = {},
      ): Promise<string | null> {
        if (!canShowDialogs) {
          return Promise.resolve(null);
        }

        const saveOptions = {
          title: 'Save File',
          buttonLabel: 'Save',
          defaultPath: options.defaultPath,
        };
        const { filePath } = await electron.remote.dialog.showSaveDialog(
          saveOptions
        );
        return filePath || null;
      },

      clipboard: {
        readText() {
          return electron.clipboard.readText();
        },

        writeText(text) {
          electron.clipboard.writeText(text);
        },

        clear() {
          electron.clipboard.clear();
        },
      },

      // ~~~~~~~~~~~~~~~~~~ //
      // Deprecated Methods //
      // ~~~~~~~~~~~~~~~~~~ //
      showGenericModalDialog(
        title,
        options = {},
      ) {
        console.warn(
          'app.showGenericModalDialog() is deprecated. Use app.dialog() instead.'
        );
        // Create DOM node so we can adapt to the new dialog() method
        const body = document.createElement('div');

        if (options.html) {
          body.innerHTML = options.html;
        }

        return this.dialog(title, body);
      },
    },
    __private: {
      axios,
      analytics,
    },
  };
}
