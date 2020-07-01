// @flow

declare module 'yaml' {
  declare module.exports: {
    stringify: Object => string,
    parse: string => Object,
    parseCST: string => Object,
  };
}
