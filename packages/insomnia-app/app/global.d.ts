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
  }
}
interface Font {
  family: string;
  italic: boolean;
  monospace: boolean;
  path: string;
  postscriptName: string;
  style: string;
  weight: number;
  width: numbe;
}
interface Window {
  __REDUX_DEVTOOLS_EXTENSION_COMPOSE__: Function;
  main: {
    restart: () => void;
    authorizeUserInWindow: (options: { url: string; urlSuccessRegex: RegExp; urlFailureRegex: RegExp; sessionId: string }) => Promise<string>;
    getAvailableFonts: () => Promise<Font[]>;
    setMenuBarVisibility: (visible: boolean) => void;
    analytics: {viewportSize: string; screenResolution: string; locale: string};
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
  net: {
    request: (options: AxiosRequestConfig) => AxiosResponse;
  };
}

// needed for @hot-loader/react-dom in order for TypeScript to build
declare const __REACT_DEVTOOLS_GLOBAL_HOOK__: undefined | {
  checkDCE: Function;
};
