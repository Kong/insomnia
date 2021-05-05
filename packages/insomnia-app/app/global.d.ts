declare module '*.svg' {
  const content: any;
  export default content;
}

declare module '*.png' {
  const content: any;
  export default content;
}

// needed for @hot-loader/react-dom in order for TypeScript to build
declare const __REACT_DEVTOOLS_GLOBAL_HOOK__: undefined | {
  checkDCE: Function;
};
