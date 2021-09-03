declare module 'electron' {
  export interface MenuItemConstructorOptions {
    // see: https://github.com/electron/electron/issues/30719 for why this module augmentation is necessary.
    selector?: string;
  }
}
