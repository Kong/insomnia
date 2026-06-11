import { getAppVersion } from 'insomnia/src/common/constants';
import type { AppContext, RenderPurpose } from 'insomnia/src/templating/types';
import { invariant } from 'insomnia/src/utils/invariant';
import { platform } from 'insomnia-data/common';

export const init = (renderPurpose: RenderPurpose = 'general'): { app: AppContext } => ({
  app: {
    alert: async (title: string, message?: string) => {
      if (__IS_RENDERER__) {
        return window.showAlert({ title, message });
      }
    },
    dialog: async (title, body, options = {}) => {
      if (__IS_RENDERER__) {
        window.showWrapper({
          ...options,
          title,
          body,
        });
      }
    },
    prompt: (title, options) => {
      if (!__IS_RENDERER__) {
        return Promise.resolve(options?.defaultValue || '');
      }
      // This custom promise converts the prompt modal from being callback-based to reject when the modal is cancelled and resolve when the modal is submitted and hidden
      return new Promise<string>((resolve, reject) => {
        let selected: string | null = null;
        window.showPrompt({
          ...options,
          title,
          onComplete: (value: string) => {
            selected = value;
          },
          // don't resolve the overall promise until the modal has hidden after clicking submit
          onHide: () => (selected !== null ? resolve(selected) : reject(new Error(`Prompt ${title} cancelled`))),
        });
      });
    },

    getPath: async (name: string) => {
      invariant(name.toLowerCase() === 'desktop', `Unknown path name ${name}`);
      return window.app.getPath('desktop');
    },

    getInfo: () => ({ version: getAppVersion(), platform: platform }),

    showSaveDialog: async (options = {}) => {
      const sendOrNoRender = renderPurpose === 'send' || renderPurpose === 'no-render';
      if (!sendOrNoRender) {
        return null;
      }

      const { filePath } = await window.dialog.showSaveDialog({
        title: 'Save File',
        buttonLabel: 'Save',
        defaultPath: options.defaultPath,
      });
      return filePath || null;
    },

    clipboard: {
      readText: async () => window.clipboard.readText(),
      writeText: async (text: string) => window.clipboard.writeText(text),
      clear: async () => window.clipboard.clear(),
    },
  },
});
