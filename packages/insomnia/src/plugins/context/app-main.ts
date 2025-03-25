import electron from 'electron';

import { getAppPlatform, getAppVersion } from '../../common/constants';
import type { AppContext, RenderPurpose } from '../../templating/types';
import { invariant } from '../../utils/invariant';

export const init = (renderPurpose: RenderPurpose = 'general'): { app: AppContext } => ({
  app: {
    alert: () => {
      throw new Error('Not implemented');
    },
    dialog: () => {
      throw new Error('Not implemented');
    },
    prompt: () => {
      throw new Error('Not implemented');
    },

    getPath: (name: string) => {
      invariant(name.toLowerCase() === 'desktop', `Unknown path name ${name}`);
      return electron.app.getPath('desktop');
    },
    getInfo: () => ({ version: getAppVersion(), platform: getAppPlatform() }),
    async showSaveDialog(options = {}): Promise<string | null> {
      const sendOrNoRender = renderPurpose === 'send' || renderPurpose === 'no-render';
      if (!sendOrNoRender) {
        return Promise.resolve(null);
      }
      const { filePath } = await electron.dialog.showSaveDialog({
        title: 'Save File',
        buttonLabel: 'Save',
        defaultPath: options.defaultPath,
      });
      return filePath || null;
    },
    clipboard: {
      readText: () => electron.clipboard.readText(),
      writeText: text => electron.clipboard.writeText(text),
      clear: () => electron.clipboard.clear(),
    },
  },
});
