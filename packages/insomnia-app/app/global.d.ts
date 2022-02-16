declare module '*.svg' {
  const content: any;
  export default content;
}

declare module '*.png' {
  const content: any;
  export default content;
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

interface Window {
  __REDUX_DEVTOOLS_EXTENSION_COMPOSE__: Function;
  main: {
    restart: () => void;
    authorizeUserInWindow: (options: { url: string; urlSuccessRegex?: RegExp; urlFailureRegex?: RegExp; sessionId: string }) => Promise<string>;
    setMenuBarVisibility: (visible: boolean) => void;
    installPlugin: (url: string) => void;
  };
  dialog: {
    showOpenDialog: (options: Electron.OpenDialogOptions) => Promise<Electron.OpenDialogReturnValue>;
    showSaveDialog: (options: Electron.SaveDialogOptions) => Promise<Electron.SaveDialogReturnValue>;
  };
  app: {
    getPath: (name: string) => string;
    getAppPath: () => string;
  };
  shell: {
    showItemInFolder: (fullPath: string) => void;
  };
}

// needed for @hot-loader/react-dom in order for TypeScript to build
declare const __REACT_DEVTOOLS_GLOBAL_HOOK__: undefined | {
  checkDCE: Function;
};
