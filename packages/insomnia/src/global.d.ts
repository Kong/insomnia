import type { MainBridgeAPI } from './main/ipc/main';

declare global {
  interface Window {
    __REDUX_DEVTOOLS_EXTENSION_COMPOSE__: Function;
    main: MainBridgeAPI;
    dialog: Pick<Electron.Dialog, 'showOpenDialog' | 'showSaveDialog'>;
    app: Pick<Electron.App, 'getPath' | 'getAppPath'>;
    shell: Pick<Electron.Shell, 'showItemInFolder'>;
  }
}

declare const __DEV__: boolean;

declare namespace NodeJS {
  interface Global {
    __DEV__: boolean;
    /** this is required by codemirror/addon/lint/json-lint */
    jsonlint: any;
    /** this is required by codemirror/addon/lint/yaml-lint */
    jsyaml: any;
  }
}
