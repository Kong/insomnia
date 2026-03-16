/// <reference types="vite/client" />
import type { HiddenBrowserWindowToMainBridgeAPI } from '../src/hidden-window-preload';
import type { RendererToMainBridgeAPI } from '../src/main/ipc/main';
import type { DatabaseBridgeAPI } from '../src/main/ipc/database';
import type { DiffMatchPatch, DiffOp } from 'diff-match-patch-ts';
import type { Services } from '~/insomnia-data';

declare global {
  interface Window {
    main: RendererToMainBridgeAPI;
    bridge: HiddenBrowserWindowToMainBridgeAPI;
    database: DatabaseBridgeAPI;
    // This is a temporary measure to provide access to services on the global window object. It will be removed in the future once all usages are updated to import services directly from the insomnia-data package.
    _dataServices?: Services;
    dialog: Pick<Electron.Dialog, 'showOpenDialog' | 'showSaveDialog'>;
    app: Pick<Electron.App, 'getPath' | 'getAppPath'>;
    shell: Pick<Electron.Shell, 'showItemInFolder' | 'openPath'>;
    clipboard: Pick<Electron.Clipboard, 'readText' | 'writeText' | 'clear'>;
    webUtils: Pick<Electron.WebUtils, 'getPathForFile'>;
    path: {
      resolve: (...paths: string[]) => string;
      dirname: (p: string) => string;
      basename: (p: string) => string;
      join: (...paths: string[]) => string;
    };
    showAlert: (options?: Record<string, any>) => void;
    showWrapper: (options?: Record<string, any>) => void;
    showPrompt: (options?: Record<string, any>) => void;

    // Required by codemirror merge addon
    diff_match_patch: typeof DiffMatchPatch;
    DIFF_DELETE: DiffOp;
    DIFF_INSERT: DiffOp;
    DIFF_EQUAL: DiffOp;
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
