// @flow

declare module 'rimraf' {
  declare module.exports: {
    sync: (path: string) => string | null,
  };
}
