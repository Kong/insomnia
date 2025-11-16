import { getAppPlatform, getAppVersion } from 'insomnia/src/common/constants';
import type { AppContext, RenderPurpose } from 'insomnia/src/templating/types';
import { invariant } from 'insomnia/src/utils/invariant';

// TODO: consider how this would work in a webworker context
const isRenderer = process.type === 'renderer';

export const init = (renderPurpose: RenderPurpose = 'general'): { app: AppContext } => ({
  app: {
    alert: (title: string, message?: string) => {
      if (isRenderer) {
        return globalThis.showAlert({ title, message });
      }
    },
    dialog: (title, body, options = {}) => {
      if (isRenderer) {
        globalThis.showWrapper({
          ...options,
          title,
          body,
        });
      }
    },
    prompt: (title, options) => {
      if (!isRenderer) {
        return Promise.resolve(options?.defaultValue || '');
      }
      // This custom promise converts the prompt modal from being callback-based to reject when the modal is cancelled and resolve when the modal is submitted and hidden
      return new Promise<string>((resolve, reject) => {
        let selected: string | null = null;
        globalThis.showPrompt({
          ...options,
          title,
          onComplete: (value: string) => {
            selected = value;
          },
          // don't resolve the overall promise until the modal has hidden after clicking submit
          onHide: () => (selected === null ? reject(new Error(`Prompt ${title} cancelled`)) : resolve(selected)),
        });
      });
    },

    getPath: (name: string) => {
      invariant(name.toLowerCase() === 'desktop', `Unknown path name ${name}`);
      return globalThis.app.getPath('desktop');
    },

    getInfo: () => ({ version: getAppVersion(), platform: getAppPlatform() }),

    showSaveDialog: async (options = {}) => {
      const sendOrNoRender = renderPurpose === 'send' || renderPurpose === 'no-render';
      if (!sendOrNoRender) {
        return null;
      }

      const { filePath } = await globalThis.dialog.showSaveDialog({
        title: 'Save File',
        buttonLabel: 'Save',
        defaultPath: options.defaultPath,
      });
      return filePath || null;
    },

    clipboard: {
      readText: () => globalThis.clipboard.readText(),
      writeText: text => globalThis.clipboard.writeText(text),
      clear: () => globalThis.clipboard.clear(),
    },
  },
});
