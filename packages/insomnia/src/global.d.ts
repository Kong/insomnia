/// <reference types="vite/client" />
import type { MainBridgeAPI } from './main/ipc/main';

declare global {
  interface Window {
    main: MainBridgeAPI;
    dialog: Pick<Electron.Dialog, 'showOpenDialog' | 'showSaveDialog'>;
    app: Pick<Electron.App, 'getPath' | 'getAppPath'>;
    shell: Pick<Electron.Shell, 'showItemInFolder'>;
    clipboard: Pick<Electron.Clipboard, 'readText' | 'writeText' | 'clear'>;
    bridge: {
      requireInterceptor: (module: string) => any;
      onmessage: (listener: (data: any, callback: (result: any) => void) => void) => void;
      cancelCurlRequest: (id: string) => void;
      curlRequest: (options: any) => Promise<any>;
      readCurlResponse: (options: { bodyPath: string; bodyCompression: Compression }) => Promise<{ body: string; error: string }>;
    };
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
