// Global types for the main process
declare global {
  namespace NodeJS {
    interface Global {
      __DEV__: boolean;
    }
  }
}

declare const __DEV__: boolean;
