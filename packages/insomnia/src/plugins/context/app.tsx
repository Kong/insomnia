import { getAppPlatform, getAppVersion } from 'insomnia/src/common/constants';
import type { AppContext, RenderPurpose } from 'insomnia/src/templating/types';
import { HtmlElementWrapper } from 'insomnia/src/ui/components/html-element-wrapper';
import { showModal } from 'insomnia/src/ui/components/modals';
import { AlertModal } from 'insomnia/src/ui/components/modals/alert-modal';
import { PromptModal } from 'insomnia/src/ui/components/modals/prompt-modal';
import { WrapperModal } from 'insomnia/src/ui/components/modals/wrapper-modal';
import { invariant } from 'insomnia/src/utils/invariant';
import React from 'react';
import type ReactDOM from 'react-dom';

export interface PrivateProperties {
  loadRendererModules: () => Promise<
    | {
        ReactDOM: typeof ReactDOM;
        React: typeof React;
      }
    | {}
  >;
}
const isRenderer = process.type === 'renderer';

export const init = (renderPurpose: RenderPurpose = 'general'): { app: AppContext; __private: PrivateProperties } => ({
  app: {
    alert: (title: string, message?: string) => {
      if (isRenderer) {
        return showModal(AlertModal, { title, message });
      }
    },
    dialog: (title, body, options = {}) => {
      if (isRenderer) {
        showModal(WrapperModal, {
          ...options,
          title,
          body: <HtmlElementWrapper el={body} onUnmount={options.onHide} />,
        });
      }
    },
    prompt: (title, options = {}) => {
      if (!isRenderer) {
        return Promise.resolve(options.defaultValue || '');
      }
      // This custom promise converts the prompt modal from being callback-based to reject when the modal is cancelled and resolve when the modal is submitted and hidden
      return new Promise<string>((resolve, reject) => {
        let selected: string | null = null;
        showModal(PromptModal, {
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

    getPath: (name: string) => {
      invariant(name.toLowerCase() === 'desktop', `Unknown path name ${name}`);
      return window.app.getPath('desktop');
    },

    getInfo: () => ({ version: getAppVersion(), platform: getAppPlatform() }),

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
      readText: () => window.clipboard.readText(),
      writeText: text => window.clipboard.writeText(text),
      clear: () => window.clipboard.clear(),
    },
  },
  __private: {
    // Provide modules that can be used in the renderer process
    async loadRendererModules() {
      if (globalThis.document === undefined) {
        return {};
      }

      const ReactDOM = await import('react-dom');
      const React = await import('react');

      return {
        ReactDOM,
        React,
      };
    },
  },
});
