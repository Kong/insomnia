// @flow

declare module 'mkdirp' {
  declare module.exports: {
    sync: (path: string) => string | null,
  };
}
