// @flow

declare module 'uuid' {
  declare module.exports: {
    v4: () => string,
    v1: () => string
  };
}
