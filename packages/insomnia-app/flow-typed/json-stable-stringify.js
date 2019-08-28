// @flow

declare module 'json-stable-stringify' {
  declare module.exports: (obj: any, opts?: { space: string }) => string;
}
