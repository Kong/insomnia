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

interface Window {
  __REDUX_DEVTOOLS_EXTENSION_COMPOSE__: Function;
}

// needed for @hot-loader/react-dom in order for TypeScript to build
declare const __REACT_DEVTOOLS_GLOBAL_HOOK__: undefined | {
  checkDCE: Function;
};
