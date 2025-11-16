/// <reference types="vite/client" />
import type { HiddenBrowserWindowToMainBridgeAPI } from '../src/hidden-window-preload';
import type { RendererToMainBridgeAPI } from '../src/main/ipc/main';
import type { DiffMatchPatch, DiffOp } from 'diff-match-patch-ts';

declare global {
  var main: RendererToMainBridgeAPI;
  var bridge: HiddenBrowserWindowToMainBridgeAPI;
  var dialog: Pick<Electron.Dialog, 'showOpenDialog' | 'showSaveDialog'>;
  var app: Pick<Electron.App, 'getPath' | 'getAppPath'>;
  var shell: Pick<Electron.Shell, 'showItemInFolder' | 'openPath'>;
  var clipboard: Pick<Electron.Clipboard, 'readText' | 'writeText' | 'clear'>;
  var webUtils: Pick<Electron.WebUtils, 'getPathForFile'>;
  var showAlert: (options?: Record<string, any>) => void;
  var showWrapper: (options?: Record<string, any>) => void;
  var showPrompt: (options?: Record<string, any>) => void;
  interface Window {
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
