/// <reference types="vite/client" />
import type { HiddenBrowserWindowToMainBridgeAPI } from '../src/hidden-window-preload';
import type { RendererToMainBridgeAPI } from '../src/main/ipc/main';

declare global {
  interface Window {
    main: RendererToMainBridgeAPI;
    bridge: HiddenBrowserWindowToMainBridgeAPI;
    dialog: Pick<Electron.Dialog, 'showOpenDialog' | 'showSaveDialog'>;
    app: Pick<Electron.App, 'getPath' | 'getAppPath'>;
    shell: Pick<Electron.Shell, 'showItemInFolder'>;
    clipboard: Pick<Electron.Clipboard, 'readText' | 'writeText' | 'clear'>;
    webUtils: Pick<Electron.WebUtils, 'getPathForFile'>;
  }
}

declare const __DEV__: boolean;

declare namespace NodeJS {
  interface Global {
    __DEV__: boolean;
    /** this is required by codemirror/addon/lint/yaml-lint */
    jsyaml: any;
  }
}
