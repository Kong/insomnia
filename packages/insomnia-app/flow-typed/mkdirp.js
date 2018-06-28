// @flow

declare module 'mkdirp' {
  declare module.exports: {
    sync: (path: string) => void
  };
}
