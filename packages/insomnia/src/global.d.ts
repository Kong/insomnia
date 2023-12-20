/// <reference types="vite/client" />
import type { HiddenBrowserWindowAPI } from './main/ipc/hidden-browser-window';
import type { MainBridgeAPI } from './main/ipc/main';

declare global {
  interface Window {
    main: MainBridgeAPI;
    dialog: Pick<Electron.Dialog, 'showOpenDialog' | 'showSaveDialog'>;
    app: Pick<Electron.App, 'getPath' | 'getAppPath'>;
    shell: Pick<Electron.Shell, 'showItemInFolder'>;
    clipboard: Pick<Electron.Clipboard, 'readText' | 'writeText' | 'clear'>;
    hiddenBrowserWindow: HiddenBrowserWindowAPI;
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
