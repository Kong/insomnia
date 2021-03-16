// @flow

declare module 'swagger-parser' {
  declare module.exports: {
    dereference: any => Promise<any>,
    YAML: {
      parse: any => any,
      dereference: string => any,
    },
  };
}
