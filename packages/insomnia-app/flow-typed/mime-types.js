// @flow

declare module 'mime-types' {
  declare module.exports: {
    lookup: (fileName: string) => string,
    extension: (mimeType: string) => string
  };
}
