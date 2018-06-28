// @flow

declare module 'fs-extra' {
  declare module.exports: {
    moveSync: (
      src: string,
      dest: string,
      options?: { overwrite?: boolean }
    ) => void
  };
}
