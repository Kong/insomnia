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
  main: { getAvailableFonts: () => Promise<Font[]> };
}

// needed for @hot-loader/react-dom in order for TypeScript to build
declare const __REACT_DEVTOOLS_GLOBAL_HOOK__: undefined | {
  checkDCE: Function;
};
